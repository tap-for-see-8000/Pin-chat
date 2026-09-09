const fs = require('fs');

// 1. Fix ChatRoomScreen
let chatRoomCode = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');
chatRoomCode = chatRoomCode.replace(/if \(outReq\) \{\s*setPendingFriendRequest\(outReq\); \/\/ We will use status to show "Pending\.\.\."\s*\}/g, '');
fs.writeFileSync('src/components/ChatRoomScreen.tsx', chatRoomCode);

// 2. Fix ProfileScreen
let profileCode = fs.readFileSync('src/components/ProfileScreen.tsx', 'utf8');
profileCode = profileCode.replace(
  "import { clearCurrentSession, updateUserPresence } from '../userService';",
  "import { clearCurrentSession, updateUserPresence, updateProfileData, checkUsernameAvailable } from '../userService';"
);
fs.writeFileSync('src/components/ProfileScreen.tsx', profileCode);
