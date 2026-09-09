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




export async function addFriend(userA: string, userB: string): Promise<void> {
  const [u1, u2] = [userA, userB].sort();
  const friendshipId = `${u1}_${u2}`;
  const friendRef = doc(db, 'friends', friendshipId);
  await setDoc(friendRef, {
    user1: u1,
    user2: u2,
    status: 'active',
    timestamp: Date.now()
  });

  // Create notification for userB if userA adds them, and vice-versa?
  // We'll create it for both or just the one who was added?
  // Let's create an exported notify function to call explicitly.
}

export async function createNotification(receiver: string, sender: string, type: 'friend_added' | 'new_message'): Promise<void> {
  const notifId = `notif_${type}_${sender}_${Date.now()}`;
  await setDoc(doc(db, 'notifications', notifId), {
    id: notifId,
    receiverUsername: receiver,
    senderUsername: sender,
    type: type,
    isRead: false,
    handled: false,
    timestamp: Date.now()
  });
}

export async function getGoalStats(username: string): Promise<{ streak: number, thirtyDayCount: number }> {
  // We'll calculate streak and 30-day progress by fetching the last 30 days of goalProgress
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().split('T')[0];
  });
  
  const progress = await getWeeklyGoalProgress(username, dates);
  
  let thirtyDayCount = 0;
  let streak = 0;
  
  // Count 30 days
  for (const date of dates) {
    if (progress[date]) {
      thirtyDayCount++;
    }
  }
  
  // Calculate current streak (working backwards from today)
  for (let i = dates.length - 1; i >= 0; i--) {
    const date = dates[i];
    if (progress[date]) {
      streak++;
    } else {
      // If today is missing, it's okay, maybe they haven't done it today yet, but if yesterday is missing, streak is 0.
      if (i === dates.length - 1) {
         // Today is missing, let's check yesterday
         continue;
      } else {
         break;
      }
    }
  }
  
  return { streak, thirtyDayCount };
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

export async function getNotifications(username: string): Promise<AppNotification[]> {
  
  const q = query(collection(db, 'notifications'), where('receiverUsername', '==', username), where('handled', '==', false));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as AppNotification).sort((a, b) => b.timestamp - a.timestamp);
}

export async function markNotificationAsHandled(notifId: string): Promise<void> {
  
  const notifRef = doc(db, 'notifications', notifId);
  await updateDoc(notifRef, { handled: true, isRead: true });
}
