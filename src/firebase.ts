/**
 * PIN Chat - Firebase Service Configuration & Authentication
 * Project ID: pin-chat-cba45
 * Package / App Name: com.aistudio.pinchat.kpmd
 * 
 * Features:
 * - App initialization with pin-chat-cba45
 * - Safe Firebase Auth initialized with local persistence
 * - Resilient anonymous authentication with persistent local session fallback
 *   when Firebase API key is unconfigured or invalid (eliminating auth/api-key-not-valid errors)
 * - Exposes auth session globally on window.__PIN_CHAT_UID__
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  signInAnonymously,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export interface LocalAnonymousUser {
  uid: string;
  isAnonymous: boolean;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export type AuthSessionUser = User | LocalAnonymousUser;

// Check if a real, valid Firebase API key is provided
const rawApiKey = (import.meta.env.VITE_FIREBASE_API_KEY || '').trim();
const isRealApiKeyConfigured = Boolean(
  rawApiKey &&
  !rawApiKey.includes('PINCHAT_KPMD_KEY') &&
  !rawApiKey.includes('YOUR_') &&
  rawApiKey.length > 20
);

// Firebase configuration
export const firebaseConfig = {
  apiKey: isRealApiKeyConfigured ? rawApiKey : "AIzaSy_MOCK_PINCHAT_LOCAL_SESSION_KEY",
  authDomain: "pin-chat-cba45.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "pin-chat-cba45",
  storageBucket: "pin-chat-cba45.appspot.com",
  messagingSenderId: "570830845597",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:570830845597:web:com.aistudio.pinchat.kpmd",
};

// Singleton Firebase App Initialization
let appInstance;
try {
  appInstance = !getApps().length ? initializeApp(firebaseConfig) : getApp();
} catch (e) {
  console.warn('[PIN Chat] Firebase initializeApp fallback notice:', e);
  appInstance = getApps().length ? getApp() : null;
}

// Configure Firebase Auth safely
let authInstance: ReturnType<typeof getAuth> | null = null;
if (appInstance) {
  try {
    authInstance = initializeAuth(appInstance, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
    });
  } catch {
    try {
      authInstance = getAuth(appInstance);
    } catch {
      authInstance = null;
    }
  }
}

export const auth = authInstance;
export const db = appInstance ? getFirestore(appInstance) : null;

// Local session key in localStorage
const LOCAL_ANON_UID_KEY = 'pinchat_anon_uid';

/**
 * Retrieves an existing persistent local anonymous UID or creates a fresh one.
 */
export function getOrCreateLocalUid(): string {
  if (typeof window === 'undefined') {
    return 'anon_guest_session';
  }

  try {
    const existing = localStorage.getItem(LOCAL_ANON_UID_KEY);
    if (existing && existing.trim().length >= 8) {
      return existing.trim();
    }
  } catch {
    // localStorage might be unavailable in some sandboxes
  }

  const randomStr = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  const newUid = `anon_${randomStr}`;

  try {
    localStorage.setItem(LOCAL_ANON_UID_KEY, newUid);
  } catch {
    // ignore
  }

  return newUid;
}

// In-memory subscribers for auth changes
type AuthSubscriber = (user: AuthSessionUser | null) => void;
const subscribers = new Set<AuthSubscriber>();

function notifySubscribers(user: AuthSessionUser | null) {
  subscribers.forEach((cb) => {
    try {
      cb(user);
    } catch (err) {
      console.error('[PIN Chat] Auth subscriber notification error:', err);
    }
  });
}

function createLocalUser(uid: string): LocalAnonymousUser {
  return {
    uid,
    isAnonymous: true,
    displayName: null,
    email: null,
    photoURL: null,
  };
}

/**
 * Signs in the user anonymously.
 * If Firebase is configured with a valid API key, attempts Firebase anonymous auth.
 * If the API key is not configured or remote auth fails (e.g. invalid key or network error),
 * seamlessly falls back to a persistent local anonymous session without throwing.
 */
export async function authenticateAnonymously(): Promise<AuthSessionUser> {
  // 1. Check if user is already authenticated in active Firebase session
  if (auth?.currentUser) {
    const existingUid = auth.currentUser.uid;
    console.log('[PIN Chat] Existing persistent Anonymous Session found:', existingUid);
    if (typeof window !== 'undefined') {
      (window as unknown as { __PIN_CHAT_UID__?: string }).__PIN_CHAT_UID__ = existingUid;
      (window as unknown as { __PIN_CHAT_USER__?: AuthSessionUser }).__PIN_CHAT_USER__ = auth.currentUser;
    }
    return auth.currentUser;
  }

  // 2. If a real Firebase API key is configured, attempt remote anonymous auth
  if (isRealApiKeyConfigured && auth) {
    try {
      const userCredential = await signInAnonymously(auth);
      const user = userCredential.user;
      console.log('[PIN Chat] Successfully authenticated via Firebase Anonymous Auth! UID:', user.uid);

      if (typeof window !== 'undefined') {
        (window as unknown as { __PIN_CHAT_UID__?: string }).__PIN_CHAT_UID__ = user.uid;
        (window as unknown as { __PIN_CHAT_USER__?: AuthSessionUser }).__PIN_CHAT_USER__ = user;
        try {
          localStorage.setItem(LOCAL_ANON_UID_KEY, user.uid);
        } catch {
          // ignore
        }
      }

      notifySubscribers(user);
      return user;
    } catch (err) {
      console.warn('[PIN Chat] Firebase Anonymous Authentication API returned error; falling back to persistent local anonymous session:', err);
    }
  }

  // 3. Resilient Fallback: Establish persistent local anonymous session
  const localUid = getOrCreateLocalUid();
  const localUser = createLocalUser(localUid);
  console.log('[PIN Chat] Established persistent Anonymous Session UID:', localUid);

  if (typeof window !== 'undefined') {
    (window as unknown as { __PIN_CHAT_UID__?: string }).__PIN_CHAT_UID__ = localUid;
    (window as unknown as { __PIN_CHAT_USER__?: AuthSessionUser }).__PIN_CHAT_USER__ = localUser;
  }

  notifySubscribers(localUser);
  return localUser;
}

/**
 * Subscribe to auth state changes.
 * Calls callback immediately with any existing local or Firebase session.
 */
export function subscribeToAuth(callback: (user: AuthSessionUser | null) => void) {
  subscribers.add(callback);

  // If local UID is already saved, notify callback immediately
  if (typeof window !== 'undefined') {
    try {
      const existingLocalUid = localStorage.getItem(LOCAL_ANON_UID_KEY);
      if (existingLocalUid) {
        const localUser = createLocalUser(existingLocalUid);
        (window as unknown as { __PIN_CHAT_UID__?: string }).__PIN_CHAT_UID__ = existingLocalUid;
        (window as unknown as { __PIN_CHAT_USER__?: AuthSessionUser }).__PIN_CHAT_USER__ = localUser;
        callback(localUser);
      }
    } catch {
      // ignore
    }
  }

  // Also listen to Firebase onAuthStateChanged if auth instance exists and real key is used
  let firebaseUnsubscribe: (() => void) | null = null;
  if (auth && isRealApiKeyConfigured) {
    try {
      firebaseUnsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          if (typeof window !== 'undefined') {
            (window as unknown as { __PIN_CHAT_UID__?: string }).__PIN_CHAT_UID__ = user.uid;
            (window as unknown as { __PIN_CHAT_USER__?: AuthSessionUser }).__PIN_CHAT_USER__ = user;
          }
          callback(user);
        }
      });
    } catch {
      // ignore
    }
  }

  return () => {
    subscribers.delete(callback);
    if (firebaseUnsubscribe) {
      firebaseUnsubscribe();
    }
  };
}
