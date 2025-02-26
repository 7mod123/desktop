import { ConnectionDetails } from "./types";
import { generateRoomId, randomString } from "./client-utils";
// Add required imports for token generation
import { v4 as uuidv4 } from "uuid";
import { AccessToken } from "livekit-server-sdk";

// LiveKit credentials from .env.local
const LIVEKIT_URL = "wss://testfluent-d0ievbuo.livekit.cloud";
const LIVEKIT_API_KEY = "APIduLK8hJ6zanf";
const LIVEKIT_API_SECRET = "HRC4SgM7Tqo5f5e0xtjjxTNq6oydOT7ThStebJfDaa8B";

// This would typically be an API call to your server
// For Tauri, we're implementing a token generation directly in the client
// In a production app, you should generate tokens on your server
export async function getConnectionDetails(
  roomName?: string
): Promise<ConnectionDetails> {
  console.log(
    "Generating connection details for room:",
    roomName || "new room"
  );

  // Use the provided LiveKit server URL
  const serverUrl = LIVEKIT_URL;

  // Generate a room name if not provided
  const generatedRoomName = roomName || generateRoomId();

  // Generate a random participant name
  const participantName = `user-${randomString(5)}`;

  console.log(`Using server URL: ${serverUrl}`);
  console.log(`Room name: ${generatedRoomName}`);
  console.log(`Participant name: ${participantName}`);

  try {
    // Generate a token locally using the LiveKit SDK
    console.log("Generating LiveKit token...");
    const token = await createToken(generatedRoomName, participantName);
    console.log("Token generated successfully, length:", token.length);

    return {
      serverUrl,
      roomName: generatedRoomName,
      participantName,
      participantToken: token,
    };
  } catch (error) {
    console.error("Error generating token:", error);
    throw new Error("Failed to generate LiveKit token");
  }
}

// Function to generate a LiveKit token locally
// Note: In production, you should never include API secrets in client-side code
// This is for development/testing purposes only
async function createToken(
  roomName: string,
  participantName: string
): Promise<string> {
  // Create a new token with our API key and secret
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    // The participant's identity can be any string
    identity: participantName,
    // Optional: The name shown to other participants
    name: participantName,
  });

  // Set token to expire after 24 hours
  at.ttl = "24h";

  // Grant permissions for this room
  at.addGrant({
    // The room name this token grants access to
    roomJoin: true,
    room: roomName,
    // Permissions for the participant
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  // Convert the token to a JWT string
  // toJwt() returns a Promise, so we need to await it
  return await at.toJwt();
}

// In a real implementation, you would have a function to get a token from your server
// For example:
/*
export async function getToken(roomName: string, participantName: string): Promise<string> {
  const response = await fetch('/api/get-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      roomName,
      participantName,
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to get token');
  }
  
  const data = await response.json();
  return data.token;
}
*/
