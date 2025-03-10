// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod lib;
mod audio_capture;

// Wrapper commands that will be exposed to JS
#[tauri::command]
fn greet(name: &str) -> String {
    lib::greet(name)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            audio_capture::start_system_audio_capture,
            audio_capture::stop_system_audio_capture,
            audio_capture::is_audio_capture_running
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
