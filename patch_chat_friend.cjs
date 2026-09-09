const fs = require('fs');
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

const importStatement = `import { doc, getDoc, onSnapshot, collection, query, where, getDocs, updateDoc, setDoc, orderBy, limit } from 'firebase/firestore';`;

// Find where to insert the useEffect.
const targetEffectStr = `  // 1. Core Chat Sync Setup & Auto-Reply Dispatch`;

const replacementEffect = `
  // 1. Core Chat Sync Setup & Auto-Reply Dispatch
  
  // Real-time Friendship & Pending Request Sync
  useEffect(() => {
    if (!db) return;
    try {
      const [u1, u2] = [currentUser.username, targetUser.username].sort();
      const friendshipId = \`\${u1}_\${u2}\`;
      const reqId1 = \`\${currentUser.username}_\${targetUser.username}\`;
      const reqId2 = \`\${targetUser.username}_\${currentUser.username}\`;
      
      const friendUnsub = onSnapshot(doc(db, 'friends', friendshipId), (snap) => {
        if (snap.exists() && snap.data().status === 'active') {
          setIsFriend(true);
          setPendingFriendRequest(null);
        } else {
          setIsFriend(false);
        }
      });
      
      const req1Unsub = onSnapshot(doc(db, 'friendRequests', reqId1), (snap) => {
        if (snap.exists() && snap.data().status === 'pending') {
          setPendingFriendRequest({ id: snap.id, ...snap.data() });
        }
      });
      
      const req2Unsub = onSnapshot(doc(db, 'friendRequests', reqId2), (snap) => {
        if (snap.exists() && snap.data().status === 'pending') {
          setPendingFriendRequest({ id: snap.id, ...snap.data() });
        }
      });
      
      return () => {
        friendUnsub();
        req1Unsub();
        req2Unsub();
      };
    } catch (err) {
      console.warn("Friend sync error:", err);
    }
  }, [currentUser.username, targetUser.username]);

`;

code = code.replace(targetEffectStr, replacementEffect);
fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);
