import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";
import "@livekit/components-styles";
import Room from "./components/room/Room";
import { ConnectionDetails } from "./lib/types";
import { getConnectionDetails } from "./lib/connection-service";
import { generateRoomId } from "./lib/client-utils";

interface AudioDevice {
  name: string;
  id: string;
}

interface RoomInfo {
  name: string;
  numParticipants: number;
  creationTime: number;
}

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showLiveKit, setShowLiveKit] = useState(false);
  const [connectionDetails, setConnectionDetails] =
    useState<ConnectionDetails | null>(null);
  const [roomName, setRoomName] = useState("");
  const [isTauriAvailable, setIsTauriAvailable] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoStartCapture, setAutoStartCapture] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [blackholeAvailable, setBlackholeAvailable] = useState<boolean>(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  useEffect(() => {
    // Check if Tauri is available
    const checkTauri = async () => {
      try {
        // This will throw an error if Tauri is not available
        await invoke("greet", { name: "test" });
        setIsTauriAvailable(true);
      } catch (error) {
        console.warn("Tauri API not available:", error);
        setIsTauriAvailable(false);
      }
    };

    checkTauri();
  }, []);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter(
          (device) => device.kind === "audioinput"
        );
        setDevices(audioDevices);

        // Check if BlackHole is available
        const blackhole = audioDevices.find((device) =>
          device.label.toLowerCase().includes("blackhole")
        );
        setBlackholeAvailable(!!blackhole);

        // Pre-select BlackHole if available, otherwise select first device
        if (blackhole) {
          setSelectedDevice(blackhole.deviceId);
        } else if (audioDevices.length > 0) {
          setSelectedDevice(audioDevices[0].deviceId);
        }
      } catch (error) {
        console.error("Error accessing media devices:", error);
        setDeviceError(
          "Failed to access audio devices. Please check permissions."
        );
      }
    };

    getDevices();
  }, []);

  useEffect(() => {
    // Only run Tauri-specific code if Tauri is available
    if (!isTauriAvailable) return;

    // Get available audio devices
    const getAudioDevices = async () => {
      try {
        const devices = await invoke<AudioDevice[]>("get_audio_devices");
        setAudioDevices(devices);

        // Look for BlackHole device and select it by default
        const blackholeDevice = devices.find((device) =>
          device.name.toLowerCase().includes("blackhole")
        );

        if (blackholeDevice) {
          setSelectedDevice(blackholeDevice.id);
        } else if (devices.length > 0) {
          setSelectedDevice(devices[0].id);
        }
      } catch (error) {
        console.error("Failed to get audio devices:", error);
      }
    };

    getAudioDevices();

    // Listen for audio level updates
    let unlistenFn: (() => void) | undefined;

    const setupListener = async () => {
      try {
        unlistenFn = await listen<number>("audio-level", (event) => {
          setAudioLevel(event.payload);
        });
      } catch (error) {
        console.error("Failed to set up audio level listener:", error);
      }
    };

    setupListener();

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [isTauriAvailable]);

  async function greet() {
    if (!isTauriAvailable) {
      setGreetMsg("Tauri API not available");
      return;
    }

    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  const startAudioCapture = async () => {
    try {
      if (!selectedDevice) {
        setDeviceError("No audio device selected");
        return;
      }

      // Verify device still exists before attempting to capture
      const currentDevices = await navigator.mediaDevices.enumerateDevices();
      const selectedDeviceExists = currentDevices
        .filter((device) => device.kind === "audioinput")
        .some((device) => device.deviceId === selectedDevice);

      if (!selectedDeviceExists) {
        setDeviceError("Selected audio device is no longer available");
        return;
      }

      setDeviceError(null);
      setIsCapturing(true);
      await invoke("start_audio_capture", { deviceId: selectedDevice });
    } catch (error) {
      console.error("Failed to start audio capture:", error);
      setDeviceError(
        `Failed to start audio capture: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      setIsCapturing(false);
    }
  };

  const stopAudioCapture = async () => {
    try {
      setIsCapturing(false);
      await invoke("stop_audio_capture");
    } catch (error) {
      console.error("Error stopping audio capture:", error);
      // Even if there's an error, we should still set isCapturing to false
      // so the UI reflects that we're not trying to capture anymore
    }
  };

  // Toggle audio capture function that decides whether to start or stop
  const toggleAudioCapture = async () => {
    if (!isTauriAvailable) {
      console.warn("Tauri API not available");
      return;
    }

    if (isCapturing) {
      await stopAudioCapture();
    } else {
      await startAudioCapture();
    }
  };

  async function exitRoom() {
    // Stop audio capture if it's running when leaving the room
    if (isCapturing) {
      await stopAudioCapture();
    }

    setConnectionDetails(null);
    setShowLiveKit(false);
  }

  async function joinRoom(roomToJoin = roomName) {
    if (!roomToJoin) {
      setConnectionError("Please enter or generate a room name");
      return;
    }

    setIsJoiningRoom(true);
    setConnectionError(null);
    console.log(`Joining room: ${roomToJoin}...`);

    try {
      // Find BlackHole device if available
      let blackholeDeviceId = selectedDevice;

      try {
        // Get all audio devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(
          (device) => device.kind === "audioinput"
        );

        // Look specifically for BlackHole
        const blackholeDevice = audioInputs.find((device) =>
          device.label.toLowerCase().includes("blackhole")
        );

        if (blackholeDevice) {
          console.log("Found BlackHole device:", blackholeDevice.label);
          blackholeDeviceId = blackholeDevice.deviceId;
          setSelectedDevice(blackholeDeviceId);
          setBlackholeAvailable(true);
        } else {
          console.warn("BlackHole device not found in available devices");
          setBlackholeAvailable(false);
        }

        // Auto-start audio capture if requested (only in desktop mode)
        if (
          !isCapturing &&
          autoStartCapture &&
          blackholeDeviceId &&
          isTauriAvailable
        ) {
          console.log(
            "Auto-starting audio capture with device:",
            blackholeDeviceId
          );
          await startAudioCapture();
        }
      } catch (error) {
        console.error("Error checking audio devices:", error);
        // Continue joining room even if device check fails
      }

      // Get connection details - ensure this is completed before moving on
      console.log("Fetching LiveKit connection details...");
      const details = await getConnectionDetails(roomToJoin);
      console.log("Connection details received:", {
        roomName: details.roomName,
        serverUrl: details.serverUrl,
        hasToken: !!details.participantToken,
        audioDevice: blackholeDeviceId || "default",
      });

      // Store room state first
      setConnectionDetails(details);

      // Then show the room component
      setShowLiveKit(true);
      setIsJoiningRoom(false);

      console.log(
        "Room component should now be displayed with audio device:",
        blackholeDeviceId || "default"
      );
    } catch (error) {
      console.error("Failed to join room:", error);
      setConnectionError(
        error instanceof Error ? error.message : "Failed to join room"
      );
      setIsJoiningRoom(false);
    }
  }

  function handleDisconnect() {
    console.log("Room disconnected, returning to main view");

    // Clean up any audio capture
    if (isCapturing) {
      stopAudioCapture().catch((err) => {
        console.error("Error stopping audio capture during disconnect:", err);
      });
    }

    // First hide the room component
    setShowLiveKit(false);

    // Then clear the connection details
    setConnectionDetails(null);

    console.log("Returned to main screen");
  }

  function generateRoom() {
    setRoomName(generateRoomId());
    setConnectionError(null);
  }

  function startNewCall() {
    const newRoomId = generateRoomId();
    setRoomName(newRoomId);
    joinRoom(newRoomId);
  }

  // Simulate fetching rooms
  async function fetchRooms() {
    setLoading(true);
    setError(null);

    try {
      // In a real app, this would be an API call to your backend
      // For demo purposes, we'll generate some mock data
      const mockRooms = [
        {
          name: generateRoomId(),
          numParticipants: Math.floor(Math.random() * 5) + 1,
          creationTime: Date.now() - Math.floor(Math.random() * 3600000),
        },
        {
          name: generateRoomId(),
          numParticipants: Math.floor(Math.random() * 3) + 1,
          creationTime: Date.now() - Math.floor(Math.random() * 7200000),
        },
      ];

      // Randomly decide if we should show rooms or empty state
      const showRooms = Math.random() > 0.5;
      setRooms(showRooms ? mockRooms : []);
    } catch (err) {
      console.error("Error fetching rooms:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch rooms");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Initial fetch on component mount only
    fetchRooms();
  }, []);

  // Calculate the height of the audio level visualization
  const levelHeight = `${Math.min(100, audioLevel * 100)}%`;

  // Check if we should show the LiveKit room - both conditions must be true
  const shouldShowRoom = showLiveKit && connectionDetails !== null;

  if (shouldShowRoom) {
    console.log("Rendering LiveKit room with details:", connectionDetails);
    return (
      <Room
        connectionDetails={connectionDetails}
        onDisconnect={handleDisconnect}
        audioDeviceId={selectedDevice}
        isCapturingSystemAudio={blackholeAvailable && autoStartCapture}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showLiveKit && connectionDetails ? (
        <Room
          connectionDetails={connectionDetails}
          onDisconnect={exitRoom}
          audioDeviceId={selectedDevice}
          isCapturingSystemAudio={blackholeAvailable && autoStartCapture}
        />
      ) : (
        <main className="flex items-center justify-center min-h-screen p-6 bg-gray-50">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full mx-auto p-6 border border-gray-200">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Active Calls</h2>
              <div className="flex items-center gap-4">
                <button
                  onClick={startNewCall}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl py-2 px-4 flex items-center gap-2 transition-all shadow-lg"
                  disabled={isJoiningRoom}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  New Call
                </button>
                <div className="group relative">
                  <button
                    onClick={fetchRooms}
                    disabled={loading}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Connection Error */}
            {connectionError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-600 text-sm">{connectionError}</p>
              </div>
            )}

            {/* Fetch Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Manual Room Join */}
            <div className="mb-6">
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => {
                    setRoomName(e.target.value);
                    setConnectionError(null);
                  }}
                  placeholder="Enter room name..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={generateRoom}
                  disabled={isJoiningRoom}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl transition-colors"
                >
                  Generate
                </button>
                <button
                  onClick={() => joinRoom()}
                  disabled={isJoiningRoom}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors"
                >
                  {isJoiningRoom ? "Connecting..." : "Join"}
                </button>
              </div>

              {/* Auto-start option */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    id="auto-start"
                    checked={autoStartCapture}
                    onChange={(e) => setAutoStartCapture(e.target.checked)}
                    className="mr-2 h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="auto-start" className="text-sm text-gray-600">
                    Automatically start audio capture when joining a room
                  </label>
                </div>

                {/* Information about BlackHole */}
                {blackholeAvailable ? (
                  <div className="blackhole-info mt-2 p-2 bg-green-100 text-green-800 rounded-md">
                    <p>
                      ✅ BlackHole audio device detected. System audio will be
                      captured automatically.
                    </p>
                  </div>
                ) : (
                  <div className="blackhole-info mt-2 p-2 bg-yellow-100 text-yellow-800 rounded-md">
                    <p>
                      ⚠️ BlackHole audio device not detected. Install BlackHole
                      to capture system audio.
                    </p>
                    <a
                      href="https://github.com/ExistentialAudio/BlackHole"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Learn more about BlackHole
                    </a>
                  </div>
                )}
              </div>

              {/* Error message display */}
              {deviceError && (
                <div className="error-message mt-2 p-2 bg-red-100 text-red-800 rounded-md">
                  <p>⚠️ {deviceError}</p>
                </div>
              )}
            </div>

            {/* Rooms List */}
            <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-18rem)] pr-2">
              {loading && !rooms.length && (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
                </div>
              )}

              {!loading && rooms.length === 0 && (
                <div className="text-center py-8">
                  <div className="bg-gray-50 rounded-xl p-8 shadow-sm border border-gray-200">
                    <svg
                      className="w-12 h-12 mx-auto text-gray-400 mb-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                    <p className="text-gray-500">No active voice rooms</p>
                  </div>
                </div>
              )}

              {rooms.map((room) => (
                <div
                  key={room.name}
                  className="bg-gray-50 hover:bg-gray-100 rounded-2xl p-4 border border-gray-200 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <div className="bg-blue-500 rounded-full p-3 shadow-lg">
                        <svg
                          className="w-6 h-6 text-white animate-pulse"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 000 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 012.828-2.828"
                          />
                        </svg>
                      </div>
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping shadow-lg" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-gray-900 font-medium">
                            {room.name}
                          </h3>
                          <p className="text-gray-500 text-sm">
                            {room.numParticipants}{" "}
                            {room.numParticipants === 1
                              ? "participant"
                              : "participants"}
                          </p>
                        </div>
                        <p className="text-gray-400 text-xs">
                          {new Date(room.creationTime).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="mt-3">
                        <button
                          onClick={() => joinRoom(room.name)}
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-xl py-2 px-4 flex items-center justify-center gap-2 transition-all shadow-md"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                            />
                          </svg>
                          Accept Call
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

export default App;
