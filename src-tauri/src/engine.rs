use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use std::io::{BufRead, BufReader, Write};
use tauri::{AppHandle, Emitter, Manager, State};
use std::thread;
use std::fs;
use std::path::PathBuf;
use futures_util::StreamExt;

pub struct EngineState {
    pub stdin: Mutex<Option<ChildStdin>>,
    pub child: Mutex<Option<Child>>,
}

impl Default for EngineState {
    fn default() -> Self {
        Self {
            stdin: Mutex::new(None),
            child: Mutex::new(None),
        }
    }
}

#[tauri::command]
pub fn start_engine(app: AppHandle, state: State<'_, EngineState>, path: String) -> Result<String, String> {
    let mut child_guard = state.child.lock().unwrap();
    let mut stdin_guard = state.stdin.lock().unwrap();

    // Kill existing engine if any
    if let Some(mut child) = child_guard.take() {
        let _ = child.kill();
    }
    *stdin_guard = None;

    let mut engine_path = PathBuf::from(&path);
    
    // If the path doesn't exist, try resolving it from the App Data engines directory
    if !engine_path.exists() {
        if let Ok(app_data_dir) = app.path().app_local_data_dir() {
            let target_exe = app_data_dir.join("engines").join(format!("{}.exe", path));
            if target_exe.exists() {
                engine_path = target_exe;
            }
        }
    }

    let mut command = Command::new(&engine_path);
    command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    match command.spawn() {
        Ok(mut child) => {
            let stdin = child.stdin.take().ok_or("Failed to get stdin")?;
            let stdout = child.stdout.take().ok_or("Failed to get stdout")?;

            *child_guard = Some(child);
            *stdin_guard = Some(stdin);

            // Spawn a thread to read engine output and emit events
            let app_clone = app.clone();
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    match line {
                        Ok(l) => {
                            let _ = app_clone.emit("engine-output", l);
                        }
                        Err(_) => break, // EOF or error
                    }
                }
            });

            Ok("Engine started".to_string())
        }
        Err(e) => Err(format!("Failed to start engine: {}", e)),
    }
}

#[tauri::command]
pub fn send_engine_command(state: State<'_, EngineState>, command: String) -> Result<(), String> {
    let mut stdin_guard = state.stdin.lock().unwrap();
    if let Some(stdin) = stdin_guard.as_mut() {
        let cmd = format!("{}\n", command);
        stdin.write_all(cmd.as_bytes()).map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Engine is not running".to_string())
    }
}

#[tauri::command]
pub fn stop_engine(state: State<'_, EngineState>) -> Result<(), String> {
    let mut child_guard = state.child.lock().unwrap();
    let mut stdin_guard = state.stdin.lock().unwrap();

    if let Some(mut child) = child_guard.take() {
        let _ = child.kill();
    }
    *stdin_guard = None;
    Ok(())
}

#[tauri::command]
pub async fn download_engine(app: AppHandle, name: String, url: String) -> Result<String, String> {
    // 1. Determine download path (AppLocalData/engines)
    let app_data_dir = app.path().app_local_data_dir().map_err(|e: tauri::Error| e.to_string())?;
    let engines_dir = app_data_dir.join("engines");
    
    // Create engines directory if it doesn't exist
    if !engines_dir.exists() {
        fs::create_dir_all(&engines_dir).map_err(|e| format!("Failed to create engines directory: {}", e))?;
    }

    // 2. Download the file as a zip
    let download_path = engines_dir.join(format!("{}.zip", name));
    let final_exe_path = engines_dir.join(format!("{}.exe", name));
    
    // Emit starting download event
    let _ = app.emit("download-progress", format!("Starting download for {}...", name));

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to download engine: {}", e))?;

    let total_size = response.content_length().unwrap_or(0);
    
    let mut file = fs::File::create(&download_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
        
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Error reading chunk: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("Error writing file: {}", e))?;
        downloaded += chunk.len() as u64;
    }

    let _ = app.emit("download-progress", format!("Download complete. Extracting executable..."));

    // 3. Extract ONLY the .exe file from the zip archive
    let file = fs::File::open(&download_path).map_err(|e| format!("Failed to open downloaded zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

    let mut found_exe = false;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("Failed to access file in zip: {}", e))?;
        
        if file.name().ends_with(".exe") {
            let mut outfile = fs::File::create(&final_exe_path).map_err(|e| format!("Failed to create extracted file: {}", e))?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| format!("Failed to copy extracted file content: {}", e))?;
            found_exe = true;
            break;
        }
    }

    // Apply executable permissions on Unix systems just in case (though the extension is .exe)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = fs::metadata(&final_exe_path) {
            let mut perms = metadata.permissions();
            perms.set_mode(0o755);
            let _ = fs::set_permissions(&final_exe_path, perms);
        }
    }

    // Clean up the ZIP
    let _ = fs::remove_file(&download_path);

    if !found_exe {
        return Err("No .exe file found inside the downloaded archive.".into());
    }

    let _ = app.emit("download-progress", format!("Successfully installed {}.", name));

    Ok(final_exe_path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn check_engine_exists(app: AppHandle, name: String) -> Result<bool, String> {
    if let Ok(app_data_dir) = app.path().app_local_data_dir() {
        let engine_exe = app_data_dir.join("engines").join(format!("{}.exe", name));
        Ok(engine_exe.exists())
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn remove_engine(app: AppHandle, name: String) -> Result<(), String> {
    if let Ok(app_data_dir) = app.path().app_local_data_dir() {
        let engine_exe = app_data_dir.join("engines").join(format!("{}.exe", name));
        if engine_exe.exists() {
            fs::remove_file(engine_exe).map_err(|e| format!("Failed to remove engine: {}", e))?;
        }
    }
    Ok(())
}
