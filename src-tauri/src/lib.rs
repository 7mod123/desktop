#![cfg_attr(mobile, feature(const_waker))]
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

// Basic greeting function
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}
