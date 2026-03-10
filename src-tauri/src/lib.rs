pub mod engine;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(engine::EngineState::default())
        .invoke_handler(tauri::generate_handler![
            greet, 
            engine::start_engine, 
            engine::send_engine_command, 
            engine::stop_engine
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
