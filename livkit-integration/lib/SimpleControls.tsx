'use client';

import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export function SimpleControls() {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const router = useRouter();

  const isMuted = !localParticipant.isMicrophoneEnabled;

  const toggleMute = useCallback(() => {
    if (isMuted) {
      localParticipant.setMicrophoneEnabled(true);
    } else {
      localParticipant.setMicrophoneEnabled(false);
    }
  }, [localParticipant, isMuted]);

  const handleLeave = useCallback(() => {
    room.disconnect();
    router.push('/');
  }, [room, router]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: '12px',
        borderRadius: '8px',
        zIndex: 1000,
      }}
    >
      <button
        onClick={toggleMute}
        style={{
          backgroundColor: isMuted ? '#ef4444' : '#22c55e',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '14px',
        }}
      >
        {isMuted ? (
          <>
            <MicOffIcon /> Unmute
          </>
        ) : (
          <>
            <MicOnIcon /> Mute
          </>
        )}
      </button>

      <button
        onClick={handleLeave}
        style={{
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '14px',
        }}
      >
        <LeaveIcon /> Leave
      </button>
    </div>
  );
}

function MicOnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9l4.19 4.18L21 20.73 4.27 3z" />
    </svg>
  );
}

function LeaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
    </svg>
  );
}
