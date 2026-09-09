const fs = require('fs');
let code = fs.readFileSync('src/userService.ts', 'utf8');

const additionalFunctions = `
import { SecretCapsule } from './types';

export const getFriendCount = async (username: string): Promise<number> => {
  if (!db) return 0;
  try {
    const friendshipsRef = collection(db, 'friendships');
    const q1 = query(friendshipsRef, where('user1', '==', username), where('status', '==', 'active'));
    const q2 = query(friendshipsRef, where('user2', '==', username), where('status', '==', 'active'));
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    return snap1.size + snap2.size;
  } catch (e) {
    console.error("Error getting friend count", e);
    return 0;
  }
};

export const updateProfileData = async (username: string, updates: Partial<UserRecord>) => {
  if (!db) return;
  const userRef = doc(db, 'users', username.toLowerCase());
  await updateDoc(userRef, updates);
  
  // Update local session
  const session = getCurrentSession();
  if (session && session.username.toLowerCase() === username.toLowerCase()) {
    saveCurrentSession({ ...session, ...updates });
  }
};

export const createSecretCapsule = async (capsule: Omit<SecretCapsule, 'id' | 'isUnlocked'>) => {
  if (!db) return;
  const capsulesRef = collection(db, 'secretCapsules');
  await addDoc(capsulesRef, {
    ...capsule,
    isUnlocked: false
  });
};

export const getSecretCapsulesForUser = (username: string, callback: (capsules: SecretCapsule[]) => void) => {
  if (!db) return () => {};
  const capsulesRef = collection(db, 'secretCapsules');
  const q = query(capsulesRef, where('receiverUsername', '==', username));
  
  return onSnapshot(q, (snapshot) => {
    const capsules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SecretCapsule));
    callback(capsules);
  });
};

export const unlockSecretCapsule = async (capsuleId: string) => {
  if (!db) return;
  const capsuleRef = doc(db, 'secretCapsules', capsuleId);
  await updateDoc(capsuleRef, { isUnlocked: true });
};
`;

code = code.replace("import { UserRecord, PublicUserProfile, FriendRequest, Friendship, ChatConversation, UserPresence } from './types';", "import { UserRecord, PublicUserProfile, FriendRequest, Friendship, ChatConversation, UserPresence, SecretCapsule } from './types';");

// Only add if not already added
if (!code.includes('updateProfileData')) {
  code += additionalFunctions;
}

fs.writeFileSync('src/userService.ts', code);
