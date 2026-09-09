const fs = require('fs');

// We need to mark messages as seen when the chat is open.
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

if (!code.includes("clearConversationUnread")) {
  code = code.replace(
    "import { saveConversationItem } from '../userService';",
    "import { saveConversationItem, clearConversationUnread } from '../userService';"
  );
  
  // When chat opens or new messages arrive while chat is open, clear unread
  code = code.replace(
    "const [messages, setMessages] = useState<ChatMessage[]>([]);",
    "const [messages, setMessages] = useState<ChatMessage[]>([]);\n\n  useEffect(() => {\n    clearConversationUnread(currentUser.username, targetUser.username);\n  }, [currentUser.username, targetUser.username, messages.length]);"
  );
}

// When a new message comes in, if we are NOT in the chat, it should be marked unread.
// Actually, `InboxScreen` should listen to new messages for all chats, or Firestore `chats` collection needs to maintain unread count.
// In this app, `saveConversationItem` is called locally. But if the app is closed, `localStorage` isn't updated.
// We need an Inbox listener to update `localStorage` when the app is open.
fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);
