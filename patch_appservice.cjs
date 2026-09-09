const fs = require('fs');
let code = fs.readFileSync('src/services/appService.ts', 'utf8');
code = code.replace(
  `export async function sendFriendRequest(sender: string, receiver: string): Promise<void> {
  const id = \`\${sender}_\${receiver}\`;
  const docRef = doc(db, 'friendRequests', id);
  await setDoc(docRef, {
    senderUsername: sender,
    receiverUsername: receiver,
    status: 'pending',
    timestamp: Date.now()
  });
}`,
  `export async function sendFriendRequest(sender: string, receiver: string): Promise<void> {
  const id = \`\${sender}_\${receiver}\`;
  
  // 1. Check if friendship already exists
  const [u1, u2] = [sender, receiver].sort();
  const friendshipId = \`\${u1}_\${u2}\`;
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
  const notifId = \`notif_\${id}\`;
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
}`
);
code = code.replace(
  `export async function acceptFriendRequest(requestId: string, sender: string, receiver: string): Promise<void> {
  const reqRef = doc(db, 'friendRequests', requestId);
  await updateDoc(reqRef, { status: 'accepted' });
  
  const [u1, u2] = [sender, receiver].sort();
  const friendshipId = \`\${u1}_\${u2}\`;
  const friendRef = doc(db, 'friends', friendshipId);
  await setDoc(friendRef, {
    user1: u1,
    user2: u2,
    status: 'active',
    timestamp: Date.now()
  });
}`,
  `export async function acceptFriendRequest(requestId: string, sender: string, receiver: string): Promise<void> {
  const reqRef = doc(db, 'friendRequests', requestId);
  await updateDoc(reqRef, { status: 'accepted' });
  
  const [u1, u2] = [sender, receiver].sort();
  const friendshipId = \`\${u1}_\${u2}\`;
  const friendRef = doc(db, 'friends', friendshipId);
  await setDoc(friendRef, {
    user1: u1,
    user2: u2,
    status: 'active',
    timestamp: Date.now()
  });
  
  // Update Notification
  const notifId = \`notif_\${requestId}\`;
  const notifRef = doc(db, 'notifications', notifId);
  const notifSnap = await getDoc(notifRef);
  if (notifSnap.exists()) {
    await updateDoc(notifRef, { handled: true, isRead: true });
  }
}`
);
code = code.replace(
  `export async function rejectFriendRequest(requestId: string): Promise<void> {
  const reqRef = doc(db, 'friendRequests', requestId);
  await updateDoc(reqRef, { status: 'rejected' });
}`,
  `export async function rejectFriendRequest(requestId: string): Promise<void> {
  const reqRef = doc(db, 'friendRequests', requestId);
  await updateDoc(reqRef, { status: 'declined' });
  
  // Update Notification
  const notifId = \`notif_\${requestId}\`;
  const notifRef = doc(db, 'notifications', notifId);
  const notifSnap = await getDoc(notifRef);
  if (notifSnap.exists()) {
    await updateDoc(notifRef, { handled: true, isRead: true });
  }
}`
);

fs.writeFileSync('src/services/appService.ts', code);
