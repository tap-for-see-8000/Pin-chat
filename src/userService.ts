/**
 * PIN Chat - User Service & Firestore Storage Engine
 * Package: com.aistudio.pinchat.kpmd
 * 
 * Features:
 * - Credentials generator:
 *   * Username: [First name in lowercase] + [Last 4 digits of mobile number] (e.g. mohit8976)
 *   * Password: [First name in lowercase] + [First 4 digits of mobile number] (e.g. mohit9876)
 * - User Registration under Firestore collection 'users' using docId = username
 * - Session Persistence via localStorage ('pinchat_auth_user') so refreshing never logs out
 * - User Login with credential verification
 * - Strict User Search by exact username in Firestore
 * - Deterministic Chat ID generator for 1-on-1 chats: chat_userA_userB
 * - Real-time User Presence (Online & Last Seen) tracking
 * - Secret Pass-Emoji Gateway storage
 * - Message Unsend & Permanent Delete helpers
 */

import { db } from './firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { UserRecord, PublicUserProfile, ChatConversation, UserPresence } from './types';

const AUTH_STORAGE_KEY = 'pinchat_auth_user';
const LOCAL_USERS_CACHE_KEY = 'pinchat_registered_users_cache';
const PRESENCE_BROADCAST_CHANNEL = 'pinchat_presence_channel';

// Helper to get local user cache for resilience
function getLocalUsersCache(): Record<string, UserRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

function saveLocalUserCache(user: UserRecord) {
  try {
    const cache = getLocalUsersCache();
    cache[user.username.toLowerCase()] = user;
    localStorage.setItem(LOCAL_USERS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

/**
 * Computes deterministic credentials from Full Name and 10-digit Mobile Number.
 * Example:
 * Name: "Mohit Yadav", Mobile: "9876548976"
 * First name lowercase: "mohit"
 * Last 4 digits: "8976"
 * First 4 digits: "9876"
 * Username: "mohit8976"
 * Password: "mohit9876"
 */
export function generateCredentials(fullName: string, mobileNumber: string): {
  username: string;
  password: string;
} {
  const parts = fullName.trim().split(/\s+/);
  const rawFirstName = parts[0] || 'user';
  const firstName = rawFirstName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';

  const cleanDigits = mobileNumber.replace(/\D/g, '');
  const digits10 = cleanDigits.slice(-10);

  const last4 = digits10.length >= 4 ? digits10.slice(-4) : '1234';
  const first4 = digits10.length >= 4 ? digits10.slice(0, 4) : '9876';

  const username = `${firstName}${last4}`;
  const password = `${firstName}${first4}`;

  return { username, password };
}

/**
 * Deterministic unique chat ID combining sorted usernames.
 * e.g. ['mohit8976', 'suman1234'].sort() -> 'chat_mohit8976_suman1234'
 */
export function getChatId(usernameA: string, usernameB: string): string {
  const u1 = usernameA.toLowerCase().trim();
  const u2 = usernameB.toLowerCase().trim();
  const sorted = [u1, u2].sort();
  return `chat_${sorted[0]}_${sorted[1]}`;
}

/**
 * Registers a new user in Firestore 'users/{username}' and localStorage.
 */
export async function registerNewUser(data: {
  fullName: string;
  mobileNumber: string;
  villageCity: string;
  pinCode: string;
}): Promise<{
  success: boolean;
  user?: UserRecord;
  error?: string;
}> {
  const cleanName = data.fullName.trim();
  const cleanMobile = data.mobileNumber.replace(/\D/g, '');
  const cleanVillage = data.villageCity.trim();
  const cleanPin = data.pinCode.replace(/\D/g, '');

  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: 'Please enter a valid full name.' };
  }
  if (cleanMobile.length !== 10) {
    return { success: false, error: 'Please enter a valid 10-digit mobile number.' };
  }
  if (!cleanVillage) {
    return { success: false, error: 'Please enter your village or city (गांव / शहर).' };
  }
  if (cleanPin.length !== 6) {
    return { success: false, error: 'Please enter a valid 6-digit Pincode (पिन कोड).' };
  }

  const { username, password } = generateCredentials(cleanName, cleanMobile);
  const now = Date.now();

  const userRecord: UserRecord = {
    username: username.toLowerCase(),
    password,
    fullName: cleanName,
    mobileNumber: cleanMobile,
    villageCity: cleanVillage,
    pinCode: cleanPin,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Cache locally
  saveLocalUserCache(userRecord);

  // 2. Write to Firestore 'users/{username}'
  if (db) {
    try {
      const userRef = doc(db, 'users', userRecord.username);
      await setDoc(userRef, {
        ...userRecord,
        serverCreated: serverTimestamp(),
      });

      // Initialize presence
      const presenceRef = doc(db, 'users', userRecord.username, 'presence', 'status');
      await setDoc(presenceRef, {
        isOnline: true,
        lastSeen: now,
      });
    } catch (err) {
      console.warn('[UserService] Firestore registration notice:', err);
    }
  }

  return { success: true, user: userRecord };
}

/**
 * Logs in an existing user with Username and Password.
 */
export async function loginWithCredentials(
  usernameInput: string,
  passwordInput: string
): Promise<{
  success: boolean;
  user?: UserRecord;
  error?: string;
}> {
  const cleanUsername = usernameInput.trim().toLowerCase();
  const cleanPassword = passwordInput.trim();

  if (!cleanUsername || !cleanPassword) {
    return { success: false, error: 'Please enter both Username and Password.' };
  }

  // 1. Check Firestore first if available
  if (db) {
    try {
      const userRef = doc(db, 'users', cleanUsername);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const data = snap.data() as UserRecord;
        if (data.password === cleanPassword) {
          saveLocalUserCache(data);
          saveCurrentSession(data);
          updateUserPresence(data.username, true);
          return { success: true, user: data };
        } else {
          return { success: false, error: 'Invalid password. Please check and try again.' };
        }
      }
    } catch (err) {
      console.warn('[UserService] Firestore login notice:', err);
    }
  }

  // 2. Check local users cache
  const cache = getLocalUsersCache();
  const cachedUser = cache[cleanUsername];

  if (cachedUser) {
    if (cachedUser.password === cleanPassword) {
      saveCurrentSession(cachedUser);
      updateUserPresence(cachedUser.username, true);
      return { success: true, user: cachedUser };
    } else {
      return { success: false, error: 'Invalid password. Please check and try again.' };
    }
  }

  return { success: false, error: 'User not found. Please register first or verify your username.' };
}

/**
 * Strict exact username search in Firestore.
 * If user does not exist, returns { exists: false, error: 'User not found' }.
 */
export async function searchUserByUsername(
  targetUsername: string,
  currentUsername: string
): Promise<{
  exists: boolean;
  user?: PublicUserProfile;
  error?: string;
}> {
  const clean = targetUsername.trim().toLowerCase();

  if (!clean) {
    return { exists: false, error: 'Please enter a username to search.' };
  }

  if (clean === currentUsername.toLowerCase()) {
    return { exists: false, error: 'You cannot start a chat with your own username.' };
  }

  // 1. Query Firestore 'users/{clean}'
  if (db) {
    try {
      const userRef = doc(db, 'users', clean);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const data = snap.data() as UserRecord;
        const publicProfile: PublicUserProfile = {
          username: data.username,
          fullName: data.fullName || data.username,
          villageCity: data.villageCity,
          pinCode: data.pinCode,
        };
        return { exists: true, user: publicProfile };
      }
    } catch (err) {
      console.warn('[UserService] Firestore search notice:', err);
    }
  }

  // 2. Check local users cache
  const cache = getLocalUsersCache();
  const cachedUser = cache[clean];

  if (cachedUser) {
    return {
      exists: true,
      user: {
        username: cachedUser.username,
        fullName: cachedUser.fullName || cachedUser.username,
        villageCity: cachedUser.villageCity,
        pinCode: cachedUser.pinCode,
      },
    };
  }

  return { exists: false, error: 'User not found' };
}

/**
 * Session persistence helpers
 */
export function getCurrentSession(): UserRecord | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

export function saveCurrentSession(user: UserRecord): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export function clearCurrentSession(): void {
  try {
    const session = getCurrentSession();
    if (session) {
      updateUserPresence(session.username, false);
    }
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * REAL-TIME USER PRESENCE (ONLINE & LAST SEEN)
 * Stored under `users/{username}/presence/status` with fields:
 * - isOnline: boolean
 * - lastSeen: number (timestamp)
 */
export async function updateUserPresence(username: string, isOnline: boolean): Promise<void> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) return;

  const now = Date.now();
  const presenceData: UserPresence = {
    isOnline,
    lastSeen: now,
  };

  // Local storage cache for presence
  try {
    localStorage.setItem(`pinchat_presence_${cleanUsername}`, JSON.stringify(presenceData));
  } catch {
    // ignore
  }

  // Broadcast to other tabs
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(PRESENCE_BROADCAST_CHANNEL);
      channel.postMessage({
        type: 'presence_update',
        username: cleanUsername,
        presence: presenceData,
      });
      channel.close();
    }
  } catch {
    // ignore
  }

  // Update in Firestore
  if (db) {
    try {
      const presenceRef = doc(db, 'users', cleanUsername, 'presence', 'status');
      await setDoc(presenceRef, presenceData, { merge: true });
    } catch (err) {
      // ignore
    }
  }
}

/**
 * Subscribes to real-time presence updates of a specific user.
 */
export function subscribeToUserPresence(
  username: string,
  onUpdate: (presence: UserPresence) => void
): () => void {
  const cleanUsername = username.trim().toLowerCase();
  let unsubFirestore: (() => void) | null = null;
  let channel: BroadcastChannel | null = null;

  // Initialize with cached presence if exists
  try {
    const cached = localStorage.getItem(`pinchat_presence_${cleanUsername}`);
    if (cached) {
      onUpdate(JSON.parse(cached));
    }
  } catch {
    // ignore
  }

  // 1. Subscribe to BroadcastChannel for zero-latency local updates
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(PRESENCE_BROADCAST_CHANNEL);
      channel.onmessage = (event) => {
        if (
          event.data?.type === 'presence_update' &&
          event.data?.username === cleanUsername &&
          event.data?.presence
        ) {
          onUpdate(event.data.presence);
        }
      };
    }
  } catch {
    // ignore
  }

  // 2. Subscribe to Firestore presence doc
  if (db) {
    try {
      const presenceRef = doc(db, 'users', cleanUsername, 'presence', 'status');
      unsubFirestore = onSnapshot(
        presenceRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserPresence;
            onUpdate({
              isOnline: Boolean(data.isOnline),
              lastSeen: data.lastSeen || Date.now(),
            });
          }
        },
        () => {
          // ignore error
        }
      );
    } catch {
      // ignore
    }
  }

  return () => {
    if (unsubFirestore) unsubFirestore();
    if (channel) channel.close();
  };
}

/**
 * Formats relative time for Last Seen in chat header.
 * E.g., "just now", "2 mins ago", "1 hour ago", etc.
 */
export function formatLastSeen(lastSeenTimestamp: number): string {
  if (!lastSeenTimestamp) return 'offline';
  const diff = Date.now() - lastSeenTimestamp;
  if (diff < 60000) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  return new Date(lastSeenTimestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * SECRET PASS-EMOJI GATEWAY STORAGE
 * Linked to current user & chatId
 */
export function getChatPassEmoji(currentUsername: string, chatId: string): string | null {
  try {
    const key = `pinchat_emoji_${currentUsername.toLowerCase()}_${chatId}`;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setChatPassEmoji(
  currentUsername: string,
  chatId: string,
  emoji: string
): void {
  try {
    const key = `pinchat_emoji_${currentUsername.toLowerCase()}_${chatId}`;
    localStorage.setItem(key, emoji);
  } catch {
    // ignore
  }
}

/**
 * MESSAGE UNSEND & PERMANENT DELETE
 */
export async function unsendFirestoreMessage(
  chatId: string,
  messageId: string
): Promise<boolean> {
  if (db) {
    try {
      const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
      await deleteDoc(msgRef);
      return true;
    } catch (err) {
      console.warn('[UserService] Unsend message note:', err);
    }
  }
  return true;
}

export async function deleteFirestoreMessage(
  chatId: string,
  messageId: string
): Promise<boolean> {
  if (db) {
    try {
      const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
      await deleteDoc(msgRef);
      return true;
    } catch (err) {
      console.warn('[UserService] Delete message note:', err);
    }
  }
  return true;
}

/**
 * Active conversation storage for Instagram-style Inbox
 */
export function getSavedConversations(username: string): ChatConversation[] {
  try {
    const raw = localStorage.getItem(`pinchat_conversations_${username.toLowerCase()}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveConversationItem(
  currentUserUsername: string,
  otherUser: PublicUserProfile,
  lastMessageText: string,
  lastMessageTime: number
): void {
  try {
    const userKey = currentUserUsername.toLowerCase();
    const chatId = getChatId(currentUserUsername, otherUser.username);
    const existing = getSavedConversations(userKey);

    const updated = existing.filter((c) => c.chatId !== chatId);
    updated.unshift({
      chatId,
      otherUser,
      lastMessageText,
      lastMessageTime,
    });

    localStorage.setItem(`pinchat_conversations_${userKey}`, JSON.stringify(updated));

    // Also update in Firestore under 'chats/{chatId}'
    if (db) {
      const chatRef = doc(db, 'chats', chatId);
      setDoc(
        chatRef,
        {
          chatId,
          participants: [currentUserUsername.toLowerCase(), otherUser.username.toLowerCase()],
          lastMessageText,
          lastMessageTime,
          updatedAt: Date.now(),
        },
        { merge: true }
      ).catch(() => {});
    }
  } catch {
    // ignore
  }
}
