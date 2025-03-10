use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use once_cell::sync::Lazy;
use serde::Serialize;
use tauri::{AppHandle, Manager, Emitter};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

// Global state to track if capture is running
static CAPTURE_STATE: Lazy<Arc<Mutex<CaptureState>>> = Lazy::new(|| {
    Arc::new(Mutex::new(CaptureState {
        is_running: false,
        should_stop: false,
    }))
});

struct CaptureState {
    is_running: bool,
    should_stop: bool,
}

#[derive(Clone, Serialize)]
struct AudioData {
    samples: Vec<f32>,
    channel_count: u32,
    sample_rate: u32,
}

#[tauri::command]
pub fn start_system_audio_capture(app_handle: AppHandle) -> Result<(), String> {
    let mut state = CAPTURE_STATE.lock().map_err(|e| e.to_string())?;
    
    if state.is_running {
        return Err("Audio capture is already running".to_string());
    }
    
    state.is_running = true;
    state.should_stop = false;
    
    let app_handle_clone = app_handle.clone();
    let state_clone = Arc::clone(&CAPTURE_STATE);
    
    // Spawn a thread for audio capture
    thread::spawn(move || {
        if let Err(e) = cpal_audio_capture(app_handle_clone, state_clone) {
            eprintln!("Audio capture error: {}", e);
        }
    });
    
    Ok(())
}

#[tauri::command]
pub fn stop_system_audio_capture() -> Result<(), String> {
    let mut state = CAPTURE_STATE.lock().map_err(|e| e.to_string())?;
    
    if !state.is_running {
        return Err("Audio capture is not running".to_string());
    }
    
    state.should_stop = true;
    
    Ok(())
}

#[tauri::command]
pub fn is_audio_capture_running() -> Result<bool, String> {
    let state = CAPTURE_STATE.lock().map_err(|e| e.to_string())?;
    Ok(state.is_running)
}

// Audio capture using cpal
fn cpal_audio_capture(app_handle: AppHandle, state: Arc<Mutex<CaptureState>>) -> Result<(), String> {
    eprintln!("Starting audio capture using cpal");
    
    // Get default host
    let host = cpal::default_host();
    
    // Try to get the default input device
    let device = match host.default_input_device() {
        Some(device) => device,
        None => {
            eprintln!("No default input device available");
            return Err("No default input device available".to_string());
        }
    };
    
    eprintln!("Using input device: {}", device.name().unwrap_or_default());
    
    // Get supported configs
    let supported_configs = match device.supported_input_configs() {
        Ok(configs) => configs.collect::<Vec<_>>(),
        Err(e) => {
            eprintln!("Error getting supported configs: {}", e);
            return Err(format!("Error getting supported configs: {}", e));
        }
    };
    
    if supported_configs.is_empty() {
        eprintln!("No supported input configs found");
        return Err("No supported input configs found".to_string());
    }
    
    // Find a suitable config (prefer f32 format)
    let config = supported_configs
        .iter()
        .find(|c| c.sample_format() == cpal::SampleFormat::F32)
        .or_else(|| supported_configs.first())
        .ok_or_else(|| "No suitable config found".to_string())?;
    
    // Use the max supported channels and a common sample rate
    let channels = config.channels();
    let sample_rate = config.max_sample_rate().0;
    let sample_format = config.sample_format();
    
    eprintln!("Using config: channels={}, sample_rate={}, format={:?}", 
        channels, sample_rate, sample_format);
    
    // Build the stream config
    let config = config.with_sample_rate(cpal::SampleRate(sample_rate)).config();
    
    // Create a buffer to store audio data
    let buffer_size = 1024 * channels as usize;
    let buffer = Arc::new(Mutex::new(Vec::with_capacity(buffer_size)));
    
    // Create a stream
    let buffer_clone = buffer.clone();
    let err_fn = move |err| {
        eprintln!("Error in audio stream: {}", err);
    };
    
    // Define the data callback based on sample format
    let stream = match sample_format {
        cpal::SampleFormat::F32 => {
            let buffer_clone = buffer_clone.clone();
            device.build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    let mut buffer = buffer_clone.lock().unwrap();
                    buffer.extend_from_slice(data);
                },
                err_fn,
                None
            )
        },
        cpal::SampleFormat::I16 => {
            let buffer_clone = buffer_clone.clone();
            device.build_input_stream(
                &config,
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    let mut buffer = buffer_clone.lock().unwrap();
                    buffer.extend(data.iter().map(|&s| (s as f32) / 32768.0));
                },
                err_fn,
                None
            )
        },
        cpal::SampleFormat::U16 => {
            let buffer_clone = buffer_clone.clone();
            device.build_input_stream(
                &config,
                move |data: &[u16], _: &cpal::InputCallbackInfo| {
                    let mut buffer = buffer_clone.lock().unwrap();
                    buffer.extend(data.iter().map(|&s| ((s as f32) - 32768.0) / 32768.0));
                },
                err_fn,
                None
            )
        },
        _ => {
            return Err("Unsupported sample format".to_string());
        }
    }.map_err(|e| format!("Error building input stream: {}", e))?;
    
    // Start the stream
    stream.play().map_err(|e| format!("Error starting stream: {}", e))?;
    
    eprintln!("Audio stream started");
    
    // Main processing loop
    let process_interval = Duration::from_millis(100); // Process every 100ms
    
    loop {
        // Check if we should stop
        {
            let state = state.lock().map_err(|e| e.to_string())?;
            if state.should_stop {
                eprintln!("Stopping audio capture");
                break;
            }
        }
        
        // Sleep for the process interval
        thread::sleep(process_interval);
        
        // Get the audio data from the buffer
        let samples = {
            let mut buffer = buffer.lock().unwrap();
            if buffer.is_empty() {
                continue;
            }
            
            // Take the data and clear the buffer
            let samples = buffer.clone();
            buffer.clear();
            samples
        };
        
        // Create audio data
        let audio_data = AudioData {
            samples,
            channel_count: channels as u32,
            sample_rate,
        };
        
        // Get the main window and emit event with audio data
        if let Some(window) = app_handle.get_webview_window("main") {
            if let Err(e) = window.emit("audio-data", &audio_data) {
                eprintln!("Error emitting audio data: {}", e);
            }
        } else {
            eprintln!("Main window not found");
        }
    }
    
    // Update state
    {
        let mut state = state.lock().map_err(|e| e.to_string())?;
        state.is_running = false;
        state.should_stop = false;
    }
    
    eprintln!("Audio capture stopped successfully");
    Ok(())
} 