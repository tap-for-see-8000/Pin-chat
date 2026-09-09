const fs = require('fs');
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

const oldEffect = `      const req1Unsub = onSnapshot(doc(db, 'friendRequests', reqId1), (snap) => {
        if (snap.exists() && snap.data().status === 'pending') {
          setPendingFriendRequest({ id: snap.id, ...snap.data() });
        }
      });
      
      const req2Unsub = onSnapshot(doc(db, 'friendRequests', reqId2), (snap) => {
        if (snap.exists() && snap.data().status === 'pending') {
          setPendingFriendRequest({ id: snap.id, ...snap.data() });
        }
      });`;

const newEffect = `      const req1Unsub = onSnapshot(doc(db, 'friendRequests', reqId1), (snap) => {
        if (snap.exists() && snap.data().status === 'pending') {
          setPendingFriendRequest({ id: snap.id, ...snap.data() });
        } else {
          setPendingFriendRequest(prev => prev?.id === reqId1 ? null : prev);
        }
      });
      
      const req2Unsub = onSnapshot(doc(db, 'friendRequests', reqId2), (snap) => {
        if (snap.exists() && snap.data().status === 'pending') {
          setPendingFriendRequest({ id: snap.id, ...snap.data() });
        } else {
          setPendingFriendRequest(prev => prev?.id === reqId2 ? null : prev);
        }
      });`;

code = code.replace(oldEffect, newEffect);
fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);
