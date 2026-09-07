/**
 * PIN Chat - Room Service
 * Manages room registration, strict PIN verification, and membership validation.
 */

import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { UserProfile } from './types';

export interface RoomRecord {
  pin: string;
  createdBy: string;
  creatorName: string;
  createdAt: number;
  members: string[];
}

const ROOMS_STORAGE_KEY = 'pinchat_registered_rooms';

// Helper to get rooms from local persistence
export function getLocalRooms(): Record<string, RoomRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ROOMS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn('[RoomService] Error loading local rooms:', err);
    return {};
  }
}

// Helper to save rooms to local persistence
export function saveLocalRoom(room: RoomRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const rooms = getLocalRooms();
    rooms[room.pin] = room;
    localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(rooms));

    // Broadcast room creation/update to other tabs
    try {
      const channel = new BroadcastChannel('pinchat_rooms_sync');
      channel.postMessage({ type: 'ROOM_UPDATED', room });
      channel.close();
    } catch {
      // BroadcastChannel optional
    }
  } catch (err) {
    console.warn('[RoomService] Error saving local room:', err);
  }
}

// Generate a clean, distinct 6-digit PIN
export function generateUniquePin(): string {
  // Generate random 6-digit numerical PIN (100000 - 999999)
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Creates and registers a new chat room.
 * Ensures the PIN is officially registered before user enters.
 */
export async function registerNewRoom(
  pin: string,
  user: Partial<UserProfile>
): Promise<RoomRecord> {
  const cleanPin = pin.trim().toUpperCase();
  const userId = user.uid || 'anon_user';
  const userName = user.displayName || 'Room Host';

  const room: RoomRecord = {
    pin: cleanPin,
    createdBy: userId,
    creatorName: userName,
    createdAt: Date.now(),
    members: [userId],
  };

  // 1. Save to local storage for immediate offline/tab resilience
  saveLocalRoom(room);

  // 2. Save to Firestore if available
  if (db) {
    try {
      const roomRef = doc(db, 'rooms', cleanPin);
      await setDoc(roomRef, {
        pin: cleanPin,
        createdBy: userId,
        creatorName: userName,
        createdAt: Date.now(),
        members: [userId],
      });
    } catch (err) {
      console.warn('[RoomService] Firestore room registration fallback to local:', err);
    }
  }

  return room;
}

export interface VerificationResult {
  exists: boolean;
  isFull: boolean;
  room?: RoomRecord;
  error?: string;
}

/**
 * Strictly verifies whether a room with the given PIN actually exists.
 * Does NOT create a room if not found.
 */
export async function verifyRoom(
  pin: string,
  currentUserId?: string
): Promise<VerificationResult> {
  const cleanPin = pin.trim().toUpperCase();

  if (!cleanPin || cleanPin.length !== 6) {
    return {
      exists: false,
      isFull: false,
      error: 'Invalid PIN or Room Not Found',
    };
  }

  // 1. Check Firestore first if active
  if (db) {
    try {
      const roomRef = doc(db, 'rooms', cleanPin);
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const data = snap.data() as RoomRecord;
        const members = Array.isArray(data.members) ? data.members : [];
        const isUserMember = Boolean(currentUserId && members.includes(currentUserId));

        // Strict 1-on-1: Maximum 2 members
        if (members.length >= 2 && !isUserMember) {
          return {
            exists: true,
            isFull: true,
            room: data,
            error: 'Room full (2/2 members active). This private room is at maximum capacity.',
          };
        }

        // Cache locally for sync
        saveLocalRoom(data);

        return {
          exists: true,
          isFull: false,
          room: data,
        };
      } else {
        // Room explicitly does NOT exist in Firestore
        return {
          exists: false,
          isFull: false,
          error: 'Invalid PIN or Room Not Found',
        };
      }
    } catch (err) {
      console.warn('[RoomService] Firestore verify fallback to local lookup:', err);
    }
  }

  // 2. Check local persistence as fallback if Firestore is unreachable
  const localRooms = getLocalRooms();
  const found = localRooms[cleanPin];

  if (!found) {
    return {
      exists: false,
      isFull: false,
      error: 'Invalid PIN or Room Not Found',
    };
  }

  const members = Array.isArray(found.members) ? found.members : [];
  const isUserMember = Boolean(currentUserId && members.includes(currentUserId));

  if (members.length >= 2 && !isUserMember) {
    return {
      exists: true,
      isFull: true,
      room: found,
      error: 'Room full (2/2 members active). This private room is at maximum capacity.',
    };
  }

  return {
    exists: true,
    isFull: false,
    room: found,
  };
}

/**
 * Joins an existing room after verification.
 */
export async function joinExistingRoom(
  pin: string,
  user: Partial<UserProfile>
): Promise<{ success: boolean; error?: string }> {
  const cleanPin = pin.trim().toUpperCase();
  const userId = user.uid || 'anon_user';

  const verify = await verifyRoom(cleanPin, userId);
  if (!verify.exists) {
    return {
      success: false,
      error: verify.error || 'Invalid PIN or Room Not Found',
    };
  }

  if (verify.isFull) {
    return {
      success: false,
      error: verify.error || 'Room full (2/2 members active).',
    };
  }

  // Add user to room members
  const localRooms = getLocalRooms();
  const existing = localRooms[cleanPin] || verify.room;

  if (existing) {
    const members = Array.isArray(existing.members) ? existing.members : [];
    if (!members.includes(userId)) {
      members.push(userId);
      existing.members = members;
      saveLocalRoom(existing);
    }
  }

  // Update Firestore if available
  if (db) {
    try {
      const roomRef = doc(db, 'rooms', cleanPin);
      await updateDoc(roomRef, {
        members: arrayUnion(userId),
      });
    } catch (err) {
      console.warn('[RoomService] Firestore join update error:', err);
    }
  }

  return { success: true };
}
