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
import { ConnectionDetails } from "../../lib/types";
import "../../styles/room.css";

interface RoomProps {
  connectionDetails: ConnectionDetails;
  onDisconnect?: () => void;
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
function CallUI() {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const room = useRoomContext();
  const [messages, setMessages] = useState<TranscriptionMessage[]>([]);

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
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-gray-900">In Call</h1>
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
                    {/* Status indicator */}
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
    </div>
  );
}

export default function Room({ connectionDetails, onDisconnect }: RoomProps) {
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);

  // Safely create room options
  const roomOptions: RoomOptions = useMemo(() => {
    try {
      return {
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          simulcast: true,
        },
        audioCaptureDefaults: {
          // Standard audio processing
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };
    } catch (err) {
      console.error("Error creating room options:", err);
      return {
        adaptiveStream: true,
        dynacast: true,
      };
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    console.log("Room component: disconnect event triggered");
    if (onDisconnect) {
      console.log("Room component: calling parent onDisconnect handler");
      onDisconnect();
    }
  }, [onDisconnect]);

  const handleError = useCallback((err: Error) => {
    console.error("Room connection error:", err);

    // Check for specific audio-related errors
    if (err.message.includes("audio") || err.message.includes("microphone")) {
      setError(`Audio error: ${err.message}`);
    } else {
      setError(`Connection error: ${err.message}`);
    }

    setConnecting(false);
  }, []);

  const handleConnected = useCallback(() => {
    console.log("Connected to room:", connectionDetails.roomName);

    setConnecting(false);
    setError(null);
  }, [connectionDetails.roomName]);

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
    <div className="h-screen flex flex-col">
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
        data-lk-theme="light"
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
            <h2 className="mt-4 text-xl font-semibold">
              Connecting to room...
            </h2>
            <p className="text-gray-600">Room: {connectionDetails.roomName}</p>
            {error && (
              <div className="mt-2 px-3 py-1 bg-red-100 text-red-700 text-sm rounded-lg">
                ⚠️ {error}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-screen bg-gray-50">
            <RoomAudioRenderer />
            <CallUI />
          </div>
        )}
      </LiveKitRoom>
    </div>
  );
}
