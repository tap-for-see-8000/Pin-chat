const fs = require('fs');
let code = fs.readFileSync('src/services/appService.ts', 'utf8');

// We'll use regex to remove the friend request functions
code = code.replace(/export async function sendFriendRequest[\s\S]*?async function getPendingFriendRequestById[\s\S]*?return null;\n\}/g, '');

const newFunctions = `
export async function addFriend(userA: string, userB: string): Promise<void> {
  const [u1, u2] = [userA, userB].sort();
  const friendshipId = \`\${u1}_\${u2}\`;
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
  const notifId = \`notif_\${type}_\${sender}_\${Date.now()}\`;
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
`;

code = code.replace("export async function getGoalStats", newFunctions + "\nexport async function getGoalStats");

fs.writeFileSync('src/services/appService.ts', code);
