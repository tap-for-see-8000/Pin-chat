import { db } from '../firebase';
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
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  MoodRecord,
  MoodType,
  FriendRequest,
  Friendship,
  GoalProgressRecord,
  UserRecord,
  AppNotification
} from '../types';

// -- MOOD --

export async function saveMood(username: string, mood: MoodType, date: string): Promise<void> {
  const moodId = `${username}_${date}`;
  const docRef = doc(db, 'moods', moodId);
  await setDoc(docRef, {
    username,
    mood,
    date,
    timestamp: Date.now()
  });
}

export async function getWeeklyMoods(username: string, dates: string[]): Promise<MoodRecord[]> {
  // Try to fetch for the specific dates
  const moods: MoodRecord[] = [];
  for (const date of dates) {
    const moodId = `${username}_${date}`;
    const docRef = doc(db, 'moods', moodId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      moods.push(snap.data() as MoodRecord);
    }
  }
  return moods;
}

// -- FRIENDS --

export async function getFriendCount(username: string): Promise<number> {
  const q1 = query(collection(db, 'friends'), where('user1', '==', username), where('status', '==', 'active'));
  const q2 = query(collection(db, 'friends'), where('user2', '==', username), where('status', '==', 'active'));
  
  const snap1 = await getDocs(q1);
  const snap2 = await getDocs(q2);
  
  return snap1.size + snap2.size;
}

export async function checkIsFriend(userA: string, userB: string): Promise<boolean> {
  const [u1, u2] = [userA, userB].sort();
  const friendshipId = `${u1}_${u2}`;
  const docRef = doc(db, 'friends', friendshipId);
  const snap = await getDoc(docRef);
  return snap.exists() && snap.data().status === 'active';
}

export async function sendFriendRequest(sender: string, receiver: string): Promise<void> {
  const id = `${sender}_${receiver}`;
  
  // 1. Check if friendship already exists
  const [u1, u2] = [sender, receiver].sort();
  const friendshipId = `${u1}_${u2}`;
  const friendshipSnap = await getDoc(doc(db, 'friends', friendshipId));
  if (friendshipSnap.exists()) return; // Already friends
  
  // 2. Check if a request already exists
  const reqSnap = await getDoc(doc(db, 'friendRequests', id));
  if (reqSnap.exists() && reqSnap.data().status === 'pending') return; // Already pending

  const docRef = doc(db, 'friendRequests', id);
  await setDoc(docRef, {
    senderUsername: sender,
    receiverUsername: receiver,
    status: 'pending',
    timestamp: Date.now()
  });

  // 3. Create Notification
  const notifId = `notif_${id}`;
  await setDoc(doc(db, 'notifications', notifId), {
    id: notifId,
    receiverUsername: receiver,
    senderUsername: sender,
    type: 'friend_request',
    relatedRequestId: id,
    isRead: false,
    handled: false,
    timestamp: Date.now()
  });
}

export async function getPendingFriendRequests(username: string): Promise<FriendRequest[]> {
  const q = query(collection(db, 'friendRequests'), where('receiverUsername', '==', username), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequest));
}

export async function acceptFriendRequest(requestId: string, sender: string, receiver: string): Promise<void> {
  const reqRef = doc(db, 'friendRequests', requestId);
  await updateDoc(reqRef, { status: 'accepted' });
  
  const [u1, u2] = [sender, receiver].sort();
  const friendshipId = `${u1}_${u2}`;
  const friendRef = doc(db, 'friends', friendshipId);
  await setDoc(friendRef, {
    user1: u1,
    user2: u2,
    status: 'active',
    timestamp: Date.now()
  });
  
  // Update Notification
  const notifId = `notif_${requestId}`;
  const notifRef = doc(db, 'notifications', notifId);
  const notifSnap = await getDoc(notifRef);
  if (notifSnap.exists()) {
    await updateDoc(notifRef, { handled: true, isRead: true });
  }
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  const reqRef = doc(db, 'friendRequests', requestId);
  await updateDoc(reqRef, { status: 'declined' });
  
  // Update Notification
  const notifId = `notif_${requestId}`;
  const notifRef = doc(db, 'notifications', notifId);
  const notifSnap = await getDoc(notifRef);
  if (notifSnap.exists()) {
    await updateDoc(notifRef, { handled: true, isRead: true });
  }
}

export async function getMessageCount(chatId: string): Promise<number> {
  // To enforce the 10-message limit, we need to know the number of messages in the chat
  // Note: getting all docs just to count is expensive, but for a 10-message limit it's okay.
  const q = query(collection(db, 'chats', chatId, 'messages'), limit(15));
  const snap = await getDocs(q);
  return snap.size;
}

// -- GOALS --

export async function saveGoalProgress(username: string, date: string, completed: boolean): Promise<void> {
  const id = `${username}_${date}`;
  const docRef = doc(db, 'goalProgress', id);
  await setDoc(docRef, {
    username,
    date,
    completed,
    timestamp: Date.now()
  });
}

export async function getWeeklyGoalProgress(username: string, dates: string[]): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  for (const date of dates) {
    const id = `${username}_${date}`;
    const docRef = doc(db, 'goalProgress', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      result[date] = snap.data().completed;
    } else {
      result[date] = false;
    }
  }
  return result;
}

export async function updateUserProfile(username: string, data: Partial<UserRecord>): Promise<void> {
  const docRef = doc(db, 'users', username);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Date.now()
  });
}

export async function getNotifications(username: string): Promise<AppNotification[]> {
  const q = query(collection(db, 'notifications'), where('receiverUsername', '==', username), where('handled', '==', false));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as AppNotification).sort((a, b) => b.timestamp - a.timestamp);
}

export async function getPendingFriendRequestById(requestId: string): Promise<FriendRequest | null> {
  const snap = await getDoc(doc(db, 'friendRequests', requestId));
  if (snap.exists()) {
    return snap.data() as FriendRequest;
  }
  return null;
}
