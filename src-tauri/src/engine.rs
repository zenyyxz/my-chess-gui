use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use std::io::{BufRead, BufReader, Write};
use tauri::{AppHandle, Emitter, State};
use std::thread;

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
