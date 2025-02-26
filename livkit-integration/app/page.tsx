'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { encodePassphrase, generateRoomId, randomString } from '@/lib/client-utils';

interface Room {
  name: string;
  numParticipants: number;
  creationTime: number;
}

export default function HomePage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [e2ee, setE2ee] = useState(false);
  const [showE2EEOptions, setShowE2EEOptions] = useState(false);
  const [sharedPassphrase, setSharedPassphrase] = useState(randomString(64));

  const startVoiceRoom = () => {
    if (e2ee) {
      router.push(`/rooms/${generateRoomId()}#${encodePassphrase(sharedPassphrase)}`);
    } else {
      router.push(`/rooms/${generateRoomId()}`);
    }
  };

  async function fetchRooms() {
    try {
      setLoading(true);
      console.log('Fetching rooms...');

      const response = await fetch('/api/rooms');
      console.log('Response status:', response.status);

      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to fetch rooms');
      }

      setRooms(data);
      setError(null);
    } catch (err) {
      console.error('Detailed error fetching rooms:', {
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        fullError: err,
      });
      setError(err instanceof Error ? err.message : 'Failed to fetch rooms');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchRooms();

    // Set up automatic refresh every 5 seconds
    const intervalId = setInterval(fetchRooms, 5000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  return (
    <>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl max-w-md w-full mx-auto p-6 border border-gray-200">
          {/* Active Rooms List */}
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Active Calls</h2>
              <div className="flex items-center gap-4">
                <button
                  onClick={startVoiceRoom}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl py-2 px-4 flex items-center gap-2 transition-all shadow-lg"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    onClick={() => fetchRooms()}
                    disabled={loading}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-3 overflow-y-auto max-h-[70vh] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent pr-2">
              {rooms.map((room) => (
                <motion.div
                  key={room.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
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
                          <h3 className="text-gray-900 font-medium">{room.name}</h3>
                          <p className="text-gray-500 text-sm">
                            {room.numParticipants}{' '}
                            {room.numParticipants === 1 ? 'participant' : 'participants'}
                          </p>
                        </div>
                        <p className="text-gray-400 text-xs">
                          {new Date(room.creationTime).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="mt-3">
                        <button
                          onClick={() => router.push(`/rooms/${room.name}`)}
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
                </motion.div>
              ))}

              {loading && !rooms.length && (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
                </div>
              )}

              {!loading && rooms.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-8"
                >
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
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
