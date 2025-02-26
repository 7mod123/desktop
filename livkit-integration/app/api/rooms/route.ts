import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      console.error('Missing LiveKit configuration:', {
        hasApiKey: !!apiKey,
        hasApiSecret: !!apiSecret,
        hasWsUrl: !!wsUrl,
      });
      return NextResponse.json({ error: 'LiveKit configuration is missing' }, { status: 500 });
    }

    // Remove 'wss://' from the beginning and '/path' from the end if present
    const host = wsUrl.replace(/^wss:\/\//, '').replace(/\/.*$/, '');
    console.log('Attempting to connect to LiveKit host:', host);

    // Create a Room Service client
    const roomService = new RoomServiceClient(`https://${host}`, apiKey, apiSecret);

    // List all rooms
    const rooms = await roomService.listRooms();
    console.log('Successfully fetched rooms:', rooms);

    return NextResponse.json(rooms);
  } catch (error) {
    console.error('Detailed error fetching rooms:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch rooms' },
      { status: 500 },
    );
  }
}
