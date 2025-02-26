#![cfg_attr(mobile, feature(const_waker))]
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use ringbuf::HeapRb;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioDevice {
    id: String,
    name: String,
}

// We'll use these static variables to manage the capture thread
static SHOULD_STOP: AtomicBool = AtomicBool::new(false);
static mut CAPTURE_THREAD_HANDLE: Option<thread::JoinHandle<()>> = None;

pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

pub fn get_audio_devices() -> Result<Vec<AudioDevice>, String> {
    let host = cpal::default_host();
    
    // Get input devices, handling errors
    let devices = match host.input_devices() {
        Ok(devices) => devices,
        Err(e) => return Err(format!("Failed to get input devices: {}", e)),
    };
    
    // Convert to our AudioDevice struct
    let mut audio_devices = Vec::new();
    for device in devices {
        if let Ok(name) = device.name() {
            audio_devices.push(AudioDevice {
                id: name.clone(),
                name,
            });
        }
    }
    
    Ok(audio_devices)
}

pub fn stop_audio_capture() -> Result<(), String> {
    // Signal the capture thread to stop
    SHOULD_STOP.store(true, Ordering::SeqCst);
    
    // Wait for the thread to finish if it exists
    unsafe {
        if let Some(handle) = CAPTURE_THREAD_HANDLE.take() {
            // Wait with a timeout to avoid hanging if the thread is stuck
            match handle.join() {
                Ok(_) => println!("Audio capture thread joined successfully"),
                Err(e) => eprintln!("Error joining audio thread: {:?}", e),
            }
        }
    }
    
    println!("Audio capture stopped");
    Ok(())
}

pub fn start_audio_capture(device_id: String) -> Result<(), String> {
    // First ensure any previous capture is stopped
    stop_audio_capture()?;
    
    // Reset the stop flag
    SHOULD_STOP.store(false, Ordering::SeqCst);

    // Find the audio device
    let host = cpal::default_host();
    let device = host
        .input_devices()
        .map_err(|e| format!("Failed to get input devices: {}", e))?
        .find(|d| {
            if let Ok(name) = d.name() {
                name.to_lowercase().contains(&device_id.to_lowercase())
            } else {
                false
            }
        })
        .or_else(|| host.default_input_device())
        .ok_or_else(|| "No audio input device found".to_string())?;

    println!("Using audio device: {:?}", device.name());

    // Get the default config for the device
    let config = device
        .default_input_config()
        .map_err(|e| format!("Failed to get default input config: {}", e))?;

    println!("Default input config: {:?}", config);

    // Create a thread to handle the audio capture
    let capture_thread = thread::spawn(move || {
        // Create a ring buffer for audio data
        let buffer_size = 1024 * 8;
        let ring = HeapRb::<f32>::new(buffer_size);
        let (mut producer, _consumer) = ring.split();

        let err_fn = |err| eprintln!("An error occurred on the audio stream: {}", err);

        // Handle different sample formats
        println!("Using format: {:?}", config.sample_format());
        
        // Build an input stream
        let stream = match config.sample_format() {
            cpal::SampleFormat::F32 => device.build_input_stream(
                &config.into(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    // Write audio data to the ring buffer
                    for &sample in data {
                        if SHOULD_STOP.load(Ordering::SeqCst) {
                            return;
                        }
                        let _ = producer.push(sample);
                    }
                },
                err_fn,
                None,
            ),
            cpal::SampleFormat::I16 => device.build_input_stream(
                &config.into(),
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    for &sample in data {
                        if SHOULD_STOP.load(Ordering::SeqCst) {
                            return;
                        }
                        let _ = producer.push(sample as f32 / i16::MAX as f32);
                    }
                },
                err_fn,
                None,
            ),
            cpal::SampleFormat::U16 => device.build_input_stream(
                &config.into(),
                move |data: &[u16], _: &cpal::InputCallbackInfo| {
                    for &sample in data {
                        if SHOULD_STOP.load(Ordering::SeqCst) {
                            return;
                        }
                        let _ = producer.push((sample as f32 / u16::MAX as f32) * 2.0 - 1.0);
                    }
                },
                err_fn,
                None,
            ),
            _ => Err(cpal::BuildStreamError::StreamConfigNotSupported),
        };

        // Check if we successfully built the stream
        match stream {
            Ok(stream) => {
                // Start the stream and keep it alive
                if let Err(e) = stream.play() {
                    eprintln!("Failed to play stream: {}", e);
                    return;
                }

                // Keep the stream alive until told to stop
                while !SHOULD_STOP.load(Ordering::SeqCst) {
                    thread::sleep(std::time::Duration::from_millis(100));
                }

                // If we reach here, we're stopping - let the stream drop
                println!("Audio capture thread stopping");
            }
            Err(e) => {
                eprintln!("Failed to build input stream: {}", e);
            }
        }
    });

    // Store the thread handle
    unsafe {
        CAPTURE_THREAD_HANDLE = Some(capture_thread);
    }

    Ok(())
}
