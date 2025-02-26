// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod lib;

// Wrapper commands that will be exposed to JS
#[tauri::command]
fn greet(name: &str) -> String {
    lib::greet(name)
}

#[tauri::command]
fn get_audio_devices() -> Result<Vec<lib::AudioDevice>, String> {
    lib::get_audio_devices()
}

#[tauri::command]
fn start_audio_capture(device_id: String) -> Result<(), String> {
    lib::start_audio_capture(device_id)
}

#[tauri::command]
fn stop_audio_capture() -> Result<(), String> {
    lib::stop_audio_capture()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet, 
            get_audio_devices, 
            start_audio_capture,
            stop_audio_capture
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
