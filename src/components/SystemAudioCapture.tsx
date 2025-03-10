import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "../lib/tauri-utils";
import {
  processSystemAudioData,
  createSystemAudioTrack,
  cleanupSystemAudio,
} from "../lib/audio-utils";

interface SystemAudioCaptureProps {
  onAudioData?: (data: AudioData) => void;
  onAudioTrackCreated?: (track: any) => void;
  onCaptureStateChange?: (isCapturing: boolean) => void;
}

interface AudioData {
  samples: number[];
  channelCount: number;
  sampleRate: number;
}

const SystemAudioCapture: React.FC<SystemAudioCaptureProps> = ({
  onAudioData,
  onAudioTrackCreated,
  onCaptureStateChange,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isTauriAvailable, setIsTauriAvailable] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<() => void>();

  // Check if Tauri is available
  useEffect(() => {
    const checkTauri = async () => {
      const available = await isTauri();
      setIsTauriAvailable(available);
    };

    checkTauri();
  }, []);

  // Set up event listener for audio data
  useEffect(() => {
    const setupListener = async () => {
      if (isTauriAvailable) {
        try {
          // Listen for audio data events from Rust
          unlistenRef.current = await listen<AudioData>(
            "audio-data",
            async (event) => {
              const { payload } = event;

              // Calculate audio level (simple RMS)
              const sum = payload.samples.reduce(
                (acc, sample) => acc + sample * sample,
                0
              );
              const rms = Math.sqrt(sum / payload.samples.length);
              setAudioLevel(rms);

              // Process the audio data
              processSystemAudioData(payload);

              // Pass audio data to parent component if callback is provided
              if (onAudioData) {
                onAudioData(payload);
              }

              // Create and provide audio track if needed
              if (isCapturing && onAudioTrackCreated) {
                try {
                  const track = await createSystemAudioTrack();
                  onAudioTrackCreated(track);
                } catch (err) {
                  console.error("Error creating system audio track:", err);
                }
              }
            }
          );
        } catch (err) {
          console.error("Error setting up audio data listener:", err);
          setError("Failed to set up audio data listener");
        }
      }
    };

    setupListener();

    // Clean up listener on unmount
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
      cleanupSystemAudio();
    };
  }, [isTauriAvailable, onAudioData, onAudioTrackCreated, isCapturing]);

  // Start audio capture
  const startCapture = async () => {
    if (!isTauriAvailable) {
      setError("Tauri is not available");
      return;
    }

    try {
      setError(null);
      await invoke("start_system_audio_capture");
      setIsCapturing(true);
      if (onCaptureStateChange) {
        onCaptureStateChange(true);
      }
    } catch (err) {
      console.error("Error starting audio capture:", err);
      setError(
        err instanceof Error ? err.message : "Failed to start audio capture"
      );
    }
  };

  // Stop audio capture
  const stopCapture = async () => {
    if (!isTauriAvailable) {
      return;
    }

    try {
      await invoke("stop_system_audio_capture");
      setIsCapturing(false);
      cleanupSystemAudio();
      if (onCaptureStateChange) {
        onCaptureStateChange(false);
      }
    } catch (err) {
      console.error("Error stopping audio capture:", err);
      setError(
        err instanceof Error ? err.message : "Failed to stop audio capture"
      );
    }
  };

  // Toggle audio capture
  const toggleCapture = () => {
    if (isCapturing) {
      stopCapture();
    } else {
      startCapture();
    }
  };

  // Calculate level height for visualization
  const levelHeight = `${Math.min(audioLevel * 100, 100)}%`;

  if (!isTauriAvailable) {
    return (
      <div className="bg-yellow-100 p-4 rounded-xl border border-yellow-200 mb-4">
        <p className="text-yellow-800">
          System audio capture is only available in the desktop app.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
      <h3 className="text-gray-900 font-medium mb-2">System Audio Capture</h3>

      <div className="flex gap-2 mb-3">
        <button
          onClick={toggleCapture}
          className={`px-3 py-2 rounded-lg text-white text-sm ${
            isCapturing
              ? "bg-red-500 hover:bg-red-600"
              : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {isCapturing ? "Stop Capturing" : "Start Capturing"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="h-4 flex-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: levelHeight }}
            ></div>
          </div>
          <span className="text-xs text-gray-500 w-12">
            {(audioLevel * 100).toFixed(0)}%
          </span>
        </div>

        <div className="mt-2 p-2 bg-green-100 text-green-800 rounded-md">
          <p>
            ✅ System audio capture is available. Click the button above to
            start capturing your system audio.
          </p>
        </div>
      </div>

      {error && (
        <div className="error-message mt-2 p-2 bg-red-100 text-red-800 rounded-md">
          <p>⚠️ {error}</p>
        </div>
      )}
    </div>
  );
};

export default SystemAudioCapture;
