const fs = require('fs');
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

code = code.replace(/!\(!friendshipData \|\| friendshipData\.status !== 'active'\)/g, '(!isFriend)');
code = code.replace(/\(!friendshipData \|\| friendshipData\.status !== 'active'\)/g, '(!isFriend)');

fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);
