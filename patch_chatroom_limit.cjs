const fs = require('fs');

let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

code = code.replace(
  `    if (!isFriend && messages.length >= 10) {
      setToastNotice("Message limit reached. Send a friend request to continue chatting.");
      setTimeout(() => setToastNotice(null), 4000);
      return;
    }`,
  ``
);

code = code.replace(
  `    if (!isFriend && messages.length >= 10) {
      setToastNotice("Message limit reached. Send a friend request to continue chatting.");
      setTimeout(() => setToastNotice(null), 4000);
      return;
    }`,
  ``
); // In case of duplicate or format diff

// Regex to catch it
code = code.replace(/if \(!isFriend && messages\.length >= 10\) \{[\s\S]*?return;\n\s*\}/, '');

fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);
