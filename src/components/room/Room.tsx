import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from "@livekit/components-react";
import {
  Track,
  RoomOptions,
  Room as LiveKitRoomType,
  ConnectionState,
  Participant,
  LocalParticipant,
  TranscriptionSegment,
} from "livekit-client";
import { SimpleControls } from "../../lib/SimpleControls";
import { SettingsMenu } from "../../lib/SettingsMenu";
import { ConnectionDetails } from "../../lib/types";
import "../../styles/room.css";

interface RoomProps {
  connectionDetails: ConnectionDetails;
  onDisconnect?: () => void;
  audioDeviceId?: string;
  isCapturingSystemAudio?: boolean;
}

interface TranscriptionMessage {
  text: string;
  participantName: string;
  isFinal: boolean;
  timestamp: number;
  isAgent: boolean;
}

// Transcription Message Component
const TranscriptionMessage = ({
  message,
  hideName,
}: {
  message: TranscriptionMessage;
  hideName?: boolean;
}) => {
  return (
    <div className={`flex flex-col ${hideName ? "pt-0" : "pt-6"}`}>
      {!hideName && (
        <div
          className={`uppercase text-xs ${
            message.isAgent ? "text-blue-500" : "text-gray-500"
          } text-right w-full`}
        >
          {message.isAgent ? "AGENT" : "USER"}
        </div>
      )}
      <div
        className={`text-sm ${
          message.isAgent ? "text-blue-500" : "text-black"
        } text-right dir-rtl`}
        style={{
          opacity: message.isFinal ? 1 : 0.7,
          transform: "translateY(0)",
        }}
      >
        {message.text}
        {!message.isFinal && (
          <span className="inline-flex">
            <span className="animate-pulse mr-1">...</span>
          </span>
        )}
      </div>
    </div>
  );
};

// Transcription Chat Component
const TranscriptionChat = ({
  messages,
}: {
  messages: TranscriptionMessage[];
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShouldAutoScroll(isAtBottom);
    }
  };

  useEffect(() => {
    if (containerRef.current && shouldAutoScroll) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, shouldAutoScroll]);

  return (
    <div className="fixed bottom-0 left-0 right-0 w-full pb-24 z-40">
      <div className="mx-auto max-w-xl">
        <div className="bg-white rounded-2xl shadow-lg mx-4">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-gray-900 font-semibold">Transcription</h2>
          </div>
          <div
            ref={containerRef}
            className="max-h-[300px] overflow-y-auto p-4"
            onScroll={handleScroll}
          >
            {messages.length === 0 ? (
              <div className="text-gray-400 text-center py-4">
                Transcription will appear here when participants speak...
              </div>
            ) : (
              <div className="flex flex-col">
                {messages.map((message, index, allMsg) => {
                  const prevMessage = allMsg[index - 1];
                  const hideName =
                    prevMessage &&
                    prevMessage.participantName === message.participantName;

                  return (
                    <TranscriptionMessage
                      key={`${message.timestamp}-${index}`}
                      message={message}
                      hideName={hideName}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Call UI Component (main component inside the room)
function CallUI({ isCapturingSystemAudio = false }) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const room = useRoomContext();
  const [messages, setMessages] = useState<TranscriptionMessage[]>([]);
  const [searchNumber, setSearchNumber] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [callRecords, setCallRecords] = useState<
    { date: string; summary: string }[]
  >([]);

  const handleSearch = async () => {
    if (!searchNumber) return;

    try {
      console.log(`Searching for call records for number: ${searchNumber}`);
      // This would be replaced with an actual API call in production
      setCallRecords([
        {
          date: "Today, 10:30 AM",
          summary: "Customer inquired about subscription options.",
        },
        {
          date: "Yesterday, 2:15 PM",
          summary: "Follow-up call regarding billing issue.",
        },
      ]);
      setShowModal(true);
    } catch (error) {
      console.error("Error fetching call records:", error);
    }
  };

  // Modal Component for call records
  const RecordsModal = () => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (
          modalRef.current &&
          !modalRef.current.contains(event.target as Node)
        ) {
          setShowModal(false);
        }
      }

      if (showModal) {
        document.addEventListener("mousedown", handleClickOutside);
        document.body.style.overflow = "hidden";
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.body.style.overflow = "unset";
      };
    }, [showModal]);

    if (!showModal) return null;

    return (
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50"
        aria-modal="true"
        role="dialog"
      >
        <div
          ref={modalRef}
          className="bg-white rounded-2xl shadow-lg max-w-xl w-full mx-4 flex flex-col"
        >
          <div className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-gray-900 font-semibold text-lg">
                Recent Call History
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {callRecords.length > 0 ? (
              <div className="space-y-3">
                {callRecords.map((record, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 rounded-lg p-3 transition-colors hover:bg-gray-100 border border-gray-200"
                  >
                    <div className="text-gray-500 text-sm mb-1">
                      {record.date}
                    </div>
                    <div className="text-gray-900 text-right">
                      {record.summary}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-center py-4">
                No recent call records found for this number.
              </div>
            )}
          </div>
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => setShowModal(false)}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Set up transcription listener
  useEffect(() => {
    const handleTranscription = (
      segments: TranscriptionSegment[],
      participant?: Participant
    ) => {
      if (!segments.length) return;

      const segment = segments[0];
      const isAgent = !(participant instanceof LocalParticipant);

      setMessages((prevMessages) => {
        const lastMessageFromParticipant = [...prevMessages]
          .reverse()
          .find((msg) => msg.isAgent === isAgent);

        if (lastMessageFromParticipant && !lastMessageFromParticipant.isFinal) {
          const updatedMessages = prevMessages.filter(
            (msg) => !(msg.isAgent === isAgent && !msg.isFinal)
          );

          return [
            ...updatedMessages,
            {
              text: segment.text,
              participantName: isAgent ? "Agent" : "User",
              isFinal: segment.final,
              timestamp: Date.now(),
              isAgent,
            },
          ];
        }

        return [
          ...prevMessages,
          {
            text: segment.text,
            participantName: isAgent ? "Agent" : "User",
            isFinal: segment.final,
            timestamp: Date.now(),
            isAgent,
          },
        ];
      });
    };

    room.on("transcriptionReceived", handleTranscription);
    return () => {
      room.off("transcriptionReceived", handleTranscription);
    };
  }, [room]);

  // Clean up old interim messages
  useEffect(() => {
    const interval = setInterval(() => {
      const fiveSecondsAgo = Date.now() - 5000;
      setMessages((prevMessages) =>
        prevMessages.filter(
          (msg) => msg.timestamp > fiveSecondsAgo || msg.isFinal
        )
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const toggleMute = async () => {
    try {
      const currentState = localParticipant.isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(!currentState);
    } catch (error) {
      console.error("Error toggling mute:", error);
    }
  };

  const handleLeave = async () => {
    try {
      await room.disconnect();
    } catch (error) {
      console.error("Error leaving room:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Main Content - Participant List */}
      <div className="w-full p-4">
        <div className="mx-auto max-w-xl">
          <div className="bg-white rounded-2xl shadow-lg">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-gray-900">In Call</h1>
                {isCapturingSystemAudio && (
                  <div className="ml-3 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-1 animate-pulse"></span>
                    System Audio
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  placeholder="Enter number..."
                  value={searchNumber}
                  onChange={(e) => setSearchNumber(e.target.value)}
                  className="px-3 py-1 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200"
                  style={{ appearance: "textfield" }}
                />
                <button
                  onClick={handleSearch}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Search
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="grid gap-3">
                {/* Local Participant */}
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium">
                        {(localParticipant.name || "You")
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="text-gray-900 font-medium">
                        {localParticipant.name || "You"}
                      </div>
                      <div className="text-blue-500 text-sm">You</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        localParticipant.isMicrophoneEnabled
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    />
                  </div>
                </div>

                {/* Other Participants */}
                {participants
                  .filter((p) => p.identity !== localParticipant.identity)
                  .filter(
                    (p) =>
                      !p.name?.toLowerCase().includes("agent") &&
                      !p.identity?.toLowerCase().includes("agent")
                  )
                  .map((participant) => (
                    <div
                      key={participant.identity}
                      className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-200"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium">
                            {(participant.name || participant.identity)
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        </div>
                        <div className="text-gray-900 font-medium">
                          {participant.name || participant.identity}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            participant.isMicrophoneEnabled
                              ? "bg-green-500"
                              : "bg-red-500"
                          }`}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Controls */}
      <div className="flex justify-center gap-8 p-6 relative z-50">
        <button
          onClick={toggleMute}
          className={`rounded-full p-4 ${
            !localParticipant.isMicrophoneEnabled
              ? "bg-red-500 hover:bg-red-600"
              : "bg-gray-600 hover:bg-gray-700"
          } text-white transition-colors`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {!localParticipant.isMicrophoneEnabled ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.39-.49 6-3.39 6-6.92h-2z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
              />
            )}
          </svg>
        </button>

        <button
          onClick={handleLeave}
          className="rounded-full p-4 bg-red-500 hover:bg-red-600 text-white transition-colors"
        >
          <svg
            className="w-6 h-6"
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
        </button>
      </div>

      {/* Transcription Chat */}
      <TranscriptionChat messages={messages} />

      {/* Records Modal */}
      <RecordsModal />
    </div>
  );
}

export default function Room({
  connectionDetails,
  onDisconnect,
  audioDeviceId,
  isCapturingSystemAudio = false,
}: RoomProps) {
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isUsingFallbackAudio, setIsUsingFallbackAudio] = useState(false);

  // Safely create room options with fallbacks for audio settings
  const roomOptions: RoomOptions = useMemo(() => {
    try {
      return {
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          simulcast: true,
        },
        audioCaptureDefaults: {
          deviceId: audioDeviceId,
          echoCancellation: !isCapturingSystemAudio,
          noiseSuppression: !isCapturingSystemAudio,
          autoGainControl: !isCapturingSystemAudio,
        },
      };
    } catch (err) {
      console.error("Error creating room options:", err);
      // Fallback to basic options without specific audio device
      return {
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          simulcast: true,
        },
      };
    }
  }, [audioDeviceId, isCapturingSystemAudio]);

  // Log audio device info for debugging
  useEffect(() => {
    if (isCapturingSystemAudio && audioDeviceId) {
      console.log("Using BlackHole for system audio capture", {
        audioDeviceId,
      });
    }
  }, [isCapturingSystemAudio, audioDeviceId]);

  const handleDisconnect = useCallback(() => {
    console.log("Room disconnected, calling onDisconnect handler");
    if (onDisconnect) {
      onDisconnect();
    }
  }, [onDisconnect]);

  const handleError = useCallback((err: Error) => {
    console.error("Room connection error:", err);

    // Check for specific audio-related errors
    if (
      err.message.includes("audio") ||
      err.message.includes("microphone") ||
      err.message.includes("device")
    ) {
      setError(
        `Audio device error: ${err.message}. Try using a different audio device.`
      );
    } else {
      setError(`Connection error: ${err.message}`);
    }

    setConnecting(false);
  }, []);

  const handleConnected = useCallback(() => {
    console.log("Connected to room:", connectionDetails.roomName);

    if (isUsingFallbackAudio && isCapturingSystemAudio) {
      setAudioError(
        "Connected using default audio device instead of BlackHole"
      );
    } else {
      setAudioError(null);
    }

    setConnecting(false);
    setError(null);
  }, [
    connectionDetails.roomName,
    isUsingFallbackAudio,
    isCapturingSystemAudio,
  ]);

  // Check if the audio device is valid
  useEffect(() => {
    const validateAudioDevice = async () => {
      if (isCapturingSystemAudio && audioDeviceId) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(
            (device) => device.kind === "audioinput"
          );
          const deviceExists = audioInputs.some(
            (device) => device.deviceId === audioDeviceId
          );

          if (!deviceExists) {
            console.warn(
              `Selected audio device (${audioDeviceId}) not found among available devices`,
              audioInputs
            );
            setAudioError(
              "Selected audio capture device not found. Please select a different device."
            );
          } else {
            setAudioError(null);
          }
        } catch (err) {
          console.error("Error validating audio device:", err);
        }
      }
    };

    validateAudioDevice();
  }, [audioDeviceId, isCapturingSystemAudio]);

  if (error) {
    return (
      <div
        className="error-container"
        style={{
          padding: "2rem",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <h2>Connection Error</h2>
        <p>{error}</p>
        <button onClick={handleDisconnect} style={{ marginTop: "1rem" }}>
          Go Back
        </button>
      </div>
    );
  }

  // Create connect options for LiveKitRoom
  const connectOptions = {
    autoSubscribe: true,
    rtcConfig: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    },
  };

  return (
    <LiveKitRoom
      serverUrl={connectionDetails.serverUrl}
      token={connectionDetails.participantToken}
      options={roomOptions}
      onDisconnected={handleDisconnect}
      onError={handleError}
      onConnected={handleConnected}
      video={false}
      audio={true}
      style={{ height: "100vh" }}
      data-lk-theme="default"
      connectOptions={connectOptions}
    >
      {connecting ? (
        <div
          className="connecting"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            flexDirection: "column",
            background: "#f9fafb",
          }}
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <h2 className="mt-4 text-xl font-semibold">Connecting to room...</h2>
          <p className="text-gray-600">Room: {connectionDetails.roomName}</p>
          {isCapturingSystemAudio && (
            <div className="mt-2 flex items-center bg-blue-50 px-3 py-1 rounded-lg text-blue-700 text-sm">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
              System Audio Capture Enabled
            </div>
          )}
          {audioError && (
            <div className="mt-2 px-3 py-1 bg-red-100 text-red-700 text-sm rounded-lg">
              ⚠️ {audioError}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col h-screen bg-gray-50">
          <RoomAudioRenderer />
          <CallUI isCapturingSystemAudio={isCapturingSystemAudio} />
        </div>
      )}
    </LiveKitRoom>
  );
}
