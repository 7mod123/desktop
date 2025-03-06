import { useState, useEffect, useCallback, useRef } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";
import "@livekit/components-styles";
import Room from "./components/room/Room";
import { ConnectionDetails } from "./lib/types";
import { getConnectionDetails } from "./lib/connection-service";
import { generateRoomId } from "./lib/client-utils";
import { Window } from "@tauri-apps/api/window";
import { isTauri, safeInvoke } from "./lib/tauri-utils";

interface RoomInfo {
  name: string;
  numParticipants: number;
  creationTime: number;
}

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
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

  useEffect(() => {
    // Check if Tauri is available
    const checkTauri = async () => {
      try {
        // Use our utility function instead of direct invoke
        const available = await isTauri();
        setIsTauriAvailable(available);

        if (available) {
          // If Tauri is available, we can safely call greet
          const greeting = await safeInvoke<string>("greet", { name: "test" });
          console.log("Tauri greeting:", greeting);
        }
      } catch (error) {
        console.warn("Tauri API check failed:", error);
        setIsTauriAvailable(false);
      }
    };

    checkTauri();
  }, []);

  // Reset joining state when LiveKit component is hidden
  useEffect(() => {
    console.log(
      "showLiveKit changed:",
      showLiveKit,
      "isJoiningRoom:",
      isJoiningRoom
    );
    if (!showLiveKit) {
      setIsJoiningRoom(false);
      console.log("Reset isJoiningRoom to false");
    }
  }, [showLiveKit, isJoiningRoom]);

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    const result = await safeInvoke<string>("greet", { name });

    // Handle the case where result is null (Tauri not available)
    if (result === null) {
      setGreetMsg("Tauri API not available");
      return;
    }

    setGreetMsg(result);
  }

  async function exitRoom() {
    console.log("Exiting room, current isJoiningRoom:", isJoiningRoom);
    setConnectionDetails(null);
    setShowLiveKit(false);
    setIsJoiningRoom(false);
    console.log("After exitRoom, isJoiningRoom set to false");
  }

  async function joinRoom(roomToJoin = roomName) {
    if (!roomToJoin) {
      setConnectionError("Please enter a room name");
      return;
    }

    console.log("Joining room:", roomToJoin);
    setConnectionError(null);
    setIsJoiningRoom(true);
    console.log("Set isJoiningRoom to true");

    try {
      // Get connection details - ensure this is completed before moving on
      const details = await getConnectionDetails(roomToJoin);
      setConnectionDetails(details);
      setShowLiveKit(true);
    } catch (error) {
      console.error("Error joining room:", error);
      setConnectionError(
        error instanceof Error ? error.message : "Failed to join room"
      );
      setIsJoiningRoom(false);
    }
  }

  function handleDisconnect() {
    console.log("Room disconnected, current isJoiningRoom:", isJoiningRoom);

    // First hide the room component
    setShowLiveKit(false);

    // Then clear the connection details
    setConnectionDetails(null);

    // Reset joining state
    setIsJoiningRoom(false);
    console.log("After handleDisconnect, isJoiningRoom set to false");

    console.log("Returned to main screen");
  }

  function generateRoom() {
    setRoomName(generateRoomId());
    setConnectionError(null);
  }

  function startNewCall() {
    // Reset any previous state
    setConnectionError(null);
    setIsJoiningRoom(false);

    // Generate a new room ID and join it
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

  // Check if we should show the LiveKit room - both conditions must be true
  const shouldShowRoom = showLiveKit && connectionDetails !== null;

  if (shouldShowRoom) {
    console.log("Rendering LiveKit room with details:", connectionDetails);
    return (
      <Room
        connectionDetails={connectionDetails}
        onDisconnect={handleDisconnect}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showLiveKit && connectionDetails ? (
        <Room connectionDetails={connectionDetails} onDisconnect={exitRoom} />
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
          </div>
        </main>
      )}
    </div>
  );
}

export default App;
