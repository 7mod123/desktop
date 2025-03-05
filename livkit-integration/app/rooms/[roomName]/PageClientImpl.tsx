"use client";

import { decodePassphrase } from "@/lib/client-utils";
import { DebugMode } from "@/lib/Debug";
import { ConnectionDetails } from "@/lib/types";
import {
  LiveKitRoom,
  LocalUserChoices,
  PreJoin,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from "@livekit/components-react";
import {
  ExternalE2EEKeyProvider,
  RoomOptions,
  Room,
  DeviceUnsupportedError,
  TranscriptionSegment,
  Participant,
  LocalParticipant,
  Track,
  RemoteParticipant,
} from "livekit-client";
import { useRouter } from "next/navigation";
import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import AIChatModal from "@/app/components/AIChatModal";
import { FaRobot } from "react-icons/fa";

const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? "/api/connection-details";

interface TranscriptionMessage {
  text: string;
  participantName: string;
  isFinal: boolean;
  timestamp: number;
  isAgent: boolean;
}

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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: message.isFinal ? 1 : 0.7, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`text-sm ${
          message.isAgent ? "text-blue-500" : "text-black"
        } text-right dir-rtl`}
        dir="rtl"
      >
        {message.text}
        {!message.isFinal && (
          <span className="inline-flex">
            <span className="animate-pulse mr-1">...</span>
          </span>
        )}
      </motion.div>
    </div>
  );
};

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

function CallUI() {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const room = useRoomContext();
  const router = useRouter();
  const [messages, setMessages] = useState<TranscriptionMessage[]>([]);
  const [searchNumber, setSearchNumber] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [callRecords, setCallRecords] = useState<
    { date: string; summary: string }[]
  >([]);
  const [showAIChat, setShowAIChat] = useState(false);

  const handleSearch = async () => {
    if (!searchNumber) return;

    try {
      const response = await fetch(`/api/call-records?number=${searchNumber}`);
      const data = await response.json();

      if (response.ok) {
        setCallRecords(data);
        setShowModal(true);
      } else {
        console.error("Error fetching call records:", data.error);
      }
    } catch (error) {
      console.error("Error fetching call records:", error);
    }
  };

  // Modal Component
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
          className="bg-white rounded-2xl shadow-lg max-w-xl w-full mx-4 flex flex-col animate-fadeIn"
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

  // Clean up old interim messages after 5 seconds
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
      router.push("/");
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
              <h1 className="text-xl font-semibold text-gray-900">In Call</h1>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  placeholder="Enter number..."
                  value={searchNumber}
                  onChange={(e) => setSearchNumber(e.target.value)}
                  className="px-3 py-1 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9l4.19 4.18L21 20.73 4.27 3z"
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
          onClick={() => setShowAIChat(true)}
          className="rounded-full p-4 bg-gray-600 text-white hover:bg-gray-700 transition-colors"
        >
          <FaRobot className="w-6 h-6" />
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

      {/* Transcription Chat - Always visible */}
      <TranscriptionChat messages={messages} />

      {/* AI Chat Modal */}
      <AIChatModal isOpen={showAIChat} onClose={() => setShowAIChat(false)} />

      {/* Records Modal */}
      <RecordsModal />
    </div>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
}) {
  const e2eePassphrase =
    typeof window !== "undefined" &&
    decodePassphrase(location.hash.substring(1));

  const worker =
    typeof window !== "undefined" &&
    e2eePassphrase &&
    new Worker(new URL("livekit-client/e2ee-worker", import.meta.url));
  const e2eeEnabled = !!(e2eePassphrase && worker);
  const keyProvider = new ExternalE2EEKeyProvider();
  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);

  const roomOptions = React.useMemo((): RoomOptions => {
    return {
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
        echoCancellation: true,
        noiseSuppression: true,
      },
      publishDefaults: {
        red: !e2eeEnabled,
      },
      e2ee: e2eeEnabled
        ? {
            keyProvider,
            worker,
          }
        : undefined,
    };
  }, [props.userChoices]);

  const room = React.useMemo(() => new Room(roomOptions), [roomOptions]);

  React.useEffect(() => {
    if (e2eeEnabled) {
      keyProvider
        .setKey(decodePassphrase(e2eePassphrase))
        .then(() => {
          room.setE2EEEnabled(true).catch((e) => {
            if (e instanceof DeviceUnsupportedError) {
              alert(
                `You're trying to join an encrypted meeting, but your browser does not support it. Please update it to the latest version and try again.`
              );
              console.error(e);
            } else {
              throw e;
            }
          });
        })
        .then(() => setE2eeSetupComplete(true));
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, room, e2eePassphrase, keyProvider]);

  const router = useRouter();
  const handleOnLeave = React.useCallback(() => router.push("/"), [router]);
  const handleError = React.useCallback((error: Error) => {
    console.error(error);
    alert(
      `Encountered an unexpected error, check the console logs for details: ${error.message}`
    );
  }, []);
  const handleEncryptionError = React.useCallback((error: Error) => {
    console.error(error);
    alert(
      `Encountered an unexpected encryption error, check the console logs for details: ${error.message}`
    );
  }, []);

  return (
    <>
      <LiveKitRoom
        connect={e2eeSetupComplete}
        room={room}
        token={String(props.connectionDetails.participantToken)}
        serverUrl={props.connectionDetails.serverUrl.replace(/\/$/, "")}
        connectOptions={{
          autoSubscribe: true,
          rtcConfig: {
            iceTransportPolicy: "all",
            bundlePolicy: "balanced",
          },
        }}
        video={false}
        audio={true}
        onDisconnected={handleOnLeave}
        onEncryptionError={handleEncryptionError}
        onError={handleError}
      >
        <div className="flex flex-col h-screen bg-gray-50">
          <RoomAudioRenderer />
          <CallUI />
        </div>
      </LiveKitRoom>
    </>
  );
}

export function PageClientImpl(props: { roomName: string; region?: string }) {
  const [connectionDetails, setConnectionDetails] = React.useState<
    ConnectionDetails | undefined
  >(undefined);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const connectToRoom = async () => {
      try {
        const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
        url.searchParams.append("roomName", props.roomName);
        url.searchParams.append("participantName", "User"); // Default username
        if (props.region) {
          url.searchParams.append("region", props.region);
        }

        console.log("Fetching connection details from:", url.toString());
        const connectionDetailsResp = await fetch(url.toString());
        const connectionDetailsData = await connectionDetailsResp.json();

        if (!connectionDetailsResp.ok) {
          throw new Error(
            connectionDetailsData.error || "Failed to get connection details"
          );
        }

        if (
          !connectionDetailsData.participantToken ||
          !connectionDetailsData.serverUrl
        ) {
          throw new Error("Invalid connection details received");
        }

        // Clean the server URL
        const cleanServerUrl = connectionDetailsData.serverUrl.replace(
          /\/$/,
          ""
        );

        const validatedDetails = {
          ...connectionDetailsData,
          serverUrl: cleanServerUrl,
          participantToken: String(connectionDetailsData.participantToken),
        };

        console.log("Received connection details:", {
          hasToken: !!validatedDetails.participantToken,
          serverUrl: validatedDetails.serverUrl,
          tokenType: typeof validatedDetails.participantToken,
        });

        setConnectionDetails(validatedDetails);
        setError(null);
      } catch (err) {
        console.error("Error connecting to room:", err);
        setError(
          err instanceof Error ? err.message : "Failed to connect to room"
        );
      }
    };

    connectToRoom();
  }, [props.roomName, props.region]);

  const defaultUserChoices: LocalUserChoices = {
    username: "User",
    videoEnabled: false,
    audioEnabled: true,
    videoDeviceId: "",
    audioDeviceId: "",
  };

  if (error) {
    return (
      <main data-lk-theme="light" style={{ height: "100%" }}>
        <div className="flex items-center justify-center h-full">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main data-lk-theme="light" style={{ height: "100%" }}>
      {connectionDetails === undefined ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <VideoConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={defaultUserChoices}
        />
      )}
    </main>
  );
}
