const fs = require('fs');

// 1. ChatRoomScreen pending friend requests
let chatRoomCode = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');
chatRoomCode = chatRoomCode.replace(/const \[pendingFriendRequest.*?useState.*?;/g, '');
chatRoomCode = chatRoomCode.replace(/await getPendingFriendRequests[\s\S]*?catch.*?\{.*?\}/, '');
// Wait, better to just remove the whole checkFriendStatus function body or safely delete the pending request logic.
