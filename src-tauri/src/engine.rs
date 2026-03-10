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

    let mut command = Command::new(&path);
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

    // 2. Download the file
    let download_path = engines_dir.join(format!("{}.zip", name));
    
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
        
        if total_size > 0 {
            // Optional: emit precise progress here if needed
            // let progress = (downloaded as f64 / total_size as f64) * 100.0;
        }
    }

    let _ = app.emit("download-progress", format!("Download complete. Extracting {}...", name));

    // 3. Extract the zip file
    let file = fs::File::open(&download_path).map_err(|e| format!("Failed to open downloaded zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

    let extract_dir = engines_dir.join(&name);
    if !extract_dir.exists() {
        fs::create_dir_all(&extract_dir).map_err(|e| format!("Failed to create extract directory: {}", e))?;
    }

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("Failed to access file in zip: {}", e))?;
        let outpath = match file.enclosed_name() {
            Some(path) => extract_dir.join(path),
            None => continue,
        };

        if (*file.name()).ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| format!("Failed to create directory in zip extraction: {}", e))?;
        } else {
            if let Some(p) = outpath.parent() {
                if !PathBuf::from(p).exists() {
                    fs::create_dir_all(p).map_err(|e| format!("Failed to create parent directory during extraction: {}", e))?;
                }
            }
            let mut outfile = fs::File::create(&outpath).map_err(|e| format!("Failed to create extracted file: {}", e))?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| format!("Failed to copy extracted file content: {}", e))?;
        }

        // Apply executable permissions on Unix systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(metadata) = fs::metadata(&outpath) {
                let mut perms = metadata.permissions();
                perms.set_mode(0o755);
                let _ = fs::set_permissions(&outpath, perms);
            }
        }
    }

    // 4. Clean up the zip file
    let _ = fs::remove_file(&download_path);

    let _ = app.emit("download-progress", format!("Successfully extracted {}.", name));

    Ok(extract_dir.to_string_lossy().into_owned())
}
