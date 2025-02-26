'use client';

import { useRoomContext } from '@livekit/components-react';
import { TranscriptionSegment, Participant } from 'livekit-client';
import { useEffect, useState } from 'react';

interface TranscriptionMessage {
  text: string;
  participantName: string;
  isFinal: boolean;
  timestamp: number;
}

export function TranscriptionModal() {
  const room = useRoomContext();
  const [messages, setMessages] = useState<TranscriptionMessage[]>([]);

  useEffect(() => {
    const handleTranscription = (segments: TranscriptionSegment[], participant?: Participant) => {
      if (!segments.length) return;

      const segment = segments[0]; // Get the latest segment
      console.log('Transcription received:', { segment, participant });

      setMessages((prevMessages) => {
        // Remove non-final messages from this participant
        const filteredMessages = prevMessages.filter(
          (msg) =>
            msg.isFinal || msg.participantName !== (participant?.name ?? participant?.identity),
        );

        const newMessage: TranscriptionMessage = {
          text: segment.text,
          participantName: participant?.name ?? participant?.identity ?? 'Unknown',
          isFinal: segment.final,
          timestamp: Date.now(),
        };

        return [...filteredMessages, newMessage];
      });
    };

    room.on('transcriptionReceived', handleTranscription);

    return () => {
      room.off('transcriptionReceived', handleTranscription);
    };
  }, [room]);

  // Remove old messages after 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const fiveSecondsAgo = Date.now() - 5000;
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.timestamp > fiveSecondsAgo || msg.isFinal),
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (messages.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '80%',
        width: '600px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: '8px',
        padding: '16px',
        color: 'white',
        zIndex: 1000,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      }}
    >
      {messages.map((msg, index) => (
        <div
          key={`${msg.timestamp}-${index}`}
          style={{
            marginBottom: '8px',
            opacity: msg.isFinal ? 1 : 0.7,
          }}
        >
          <span style={{ fontWeight: 'bold', marginRight: '8px' }}>{msg.participantName}:</span>
          <span>
            {msg.text}
            {!msg.isFinal && '...'}
          </span>
        </div>
      ))}
    </div>
  );
}
