const fs = require('fs');

// We need to trigger createNotification('new_message') when a message is sent
// And we need the conversation list to show unread dot
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

if (!code.includes("createNotification(")) {
  code = code.replace(
    "import { saveConversationItem } from '../userService';",
    "import { saveConversationItem } from '../userService';\nimport { createNotification } from '../services/appService';"
  );
  
  // Find where messages are sent
  code = code.replace(
    "// 2) AI Context Generation",
    "// 2) AI Context Generation\n      // Create notification for recipient if not online\n      if (!partnerPresence.isOnline) {\n        createNotification(targetUser.username, currentUser.username, 'new_message');\n      }"
  );
}

fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);
