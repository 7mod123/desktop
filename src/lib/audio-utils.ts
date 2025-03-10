import { LocalAudioTrack, createLocalAudioTrack, Track } from "livekit-client";

interface AudioData {
  samples: number[];
  channelCount: number;
  sampleRate: number;
}

// Audio context for processing system audio
let audioContext: AudioContext | null = null;
let systemAudioTrack: LocalAudioTrack | null = null;
let mediaStreamDestination: MediaStreamAudioDestinationNode | null = null;
let gainNode: GainNode | null = null;

/**
 * Initialize the audio context and nodes for system audio processing
 */
export function initializeAudioContext(): void {
  if (!audioContext) {
    audioContext = new AudioContext({
      latencyHint: "interactive",
      sampleRate: 48000,
    });

    // Create a gain node for volume control
    gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0; // Default volume

    // Create a destination node to get a MediaStream
    mediaStreamDestination = audioContext.createMediaStreamDestination();

    // Connect the gain node to the destination
    gainNode.connect(mediaStreamDestination);
  }
}

/**
 * Process audio data from the system audio capture
 * @param audioData The audio data from the system audio capture
 */
export function processSystemAudioData(audioData: AudioData): void {
  if (!audioContext || !gainNode || !mediaStreamDestination) {
    initializeAudioContext();
  }

  if (audioContext && gainNode && mediaStreamDestination) {
    // Create a buffer with the audio data
    const buffer = audioContext.createBuffer(
      audioData.channelCount,
      audioData.samples.length / audioData.channelCount,
      audioData.sampleRate
    );

    // Fill the buffer with the audio data
    for (let channel = 0; channel < audioData.channelCount; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] =
          audioData.samples[i * audioData.channelCount + channel];
      }
    }

    // Create a buffer source node
    const source = audioContext.createBufferSource();
    source.buffer = buffer;

    // Connect the source to the gain node
    source.connect(gainNode);

    // Start playing the buffer
    source.start();
  }
}

/**
 * Create a LiveKit audio track from the system audio
 * @returns A promise that resolves to a LocalAudioTrack
 */
export async function createSystemAudioTrack(): Promise<LocalAudioTrack> {
  if (!mediaStreamDestination) {
    initializeAudioContext();
  }

  if (!mediaStreamDestination) {
    throw new Error("Failed to initialize audio context");
  }

  // If we already have a track, return it
  if (systemAudioTrack) {
    return systemAudioTrack;
  }

  // Get the audio track from the media stream
  const mediaStreamTrack = mediaStreamDestination.stream.getAudioTracks()[0];

  // Create a new LocalAudioTrack directly
  systemAudioTrack = new LocalAudioTrack(mediaStreamTrack, undefined, false);

  // Set the source to indicate it's system audio
  systemAudioTrack.source = Track.Source.Microphone;

  return systemAudioTrack;
}

/**
 * Set the volume of the system audio
 * @param volume A value between 0 and 1
 */
export function setSystemAudioVolume(volume: number): void {
  if (gainNode) {
    gainNode.gain.value = Math.max(0, Math.min(1, volume));
  }
}

/**
 * Clean up audio resources
 */
export function cleanupSystemAudio(): void {
  if (systemAudioTrack) {
    systemAudioTrack.stop();
    systemAudioTrack = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  mediaStreamDestination = null;
  gainNode = null;
}
