const fs = require('fs');
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

// Remove Friendship Banner
code = code.replace(/\{\!\isFriend && \([\s\S]*?\}\) \? \([\s\S]*?\) : \(\s*<div[\s\S]*?<\/div>\s*\)\s*\}\s*<\/div>\s*\)\s*\}/, '');
// Let's do it differently, we will just use a regex that matches the whole Friendship Banner block.
code = code.replace(/\{\/\* Friendship Banner \*\/\}\s*\{\!isFriend && \([\s\S]*?<\!\-\- This ends where the block ends \-\->/g, '');

// A safer way: write a regex or just substring replacement.
