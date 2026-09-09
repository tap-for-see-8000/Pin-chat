const fs = require('fs');
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

code = code.replace(
  /\/\/ Check for outgoing request[\s\S]*?\} \/\* We will use status to show "Pending\.\.\." \*\//,
  ''
);

fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);

let profileCode = fs.readFileSync('src/components/ProfileScreen.tsx', 'utf8');
profileCode = profileCode.replace(/updateUserProfile/g, 'updateProfileData');
fs.writeFileSync('src/components/ProfileScreen.tsx', profileCode);
