const fs = require('fs');
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

code = code.replace(/const \[pendingFriendRequest, setPendingFriendRequest\] = useState<any>\(null\);/, '');

code = code.replace(
  /\/\/ Check if there is a pending request to us from them[\s\S]*?\} \/\* We will use status to show "Pending..." \*\//,
  ''
);

// We need to just safely remove `getPendingFriendRequests` usage
code = code.replace(/const requests = await getPendingFriendRequests\(currentUser.username\);/g, '');
code = code.replace(/const req = requests.find\(r => r.senderUsername === targetUser.username\);/g, '');
code = code.replace(/if \(req\) \{\n        setPendingFriendRequest\(req\);\n      \}/g, '');
code = code.replace(/const outRequests = await getPendingFriendRequests\(targetUser.username\);/g, '');
code = code.replace(/const outReq = outRequests.find\(r => r.senderUsername === currentUser.username\);/g, '');
code = code.replace(/if \(outReq\) \{\n        setPendingFriendRequest\(outReq\);\n      \}/g, '');
code = code.replace(/setPendingFriendRequest\(null\);/g, '');

fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);

// 2. InboxScreen `db` missing
let inboxCode = fs.readFileSync('src/components/InboxScreen.tsx', 'utf8');
inboxCode = inboxCode.replace(
  "import { searchUserByUsername, getSavedConversations, saveConversationItem, getChatId } from '../userService';",
  "import { searchUserByUsername, getSavedConversations, saveConversationItem, getChatId } from '../userService';\nimport { db } from '../firebase';"
);
fs.writeFileSync('src/components/InboxScreen.tsx', inboxCode);

// 3. NotificationsScreen `getNotifications` and `markNotificationAsHandled` missing
