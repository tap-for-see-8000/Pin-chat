const fs = require('fs');
let code = fs.readFileSync('src/userService.ts', 'utf8');

// We want to pass unread state to saveConversationItem
code = code.replace(
  "export function saveConversationItem(\n  currentUserUsername: string,\n  otherUser: PublicUserProfile,\n  lastMessageText: string,\n  lastMessageTime: number\n): void {",
  "export function saveConversationItem(\n  currentUserUsername: string,\n  otherUser: PublicUserProfile,\n  lastMessageText: string,\n  lastMessageTime: number,\n  unread: boolean = false\n): void {"
);

code = code.replace(
  `        item.lastMessageText = lastMessageText;
        item.lastMessageTime = lastMessageTime;`,
  `        item.lastMessageText = lastMessageText;
        item.lastMessageTime = lastMessageTime;
        if (unread) item.unread = true;`
);

code = code.replace(
  `        lastMessageTime,
      });`,
  `        lastMessageTime,
        unread
      });`
);

// We need a clearUnread function
code += `
export function clearConversationUnread(currentUserUsername: string, targetUsername: string): void {
  try {
    const userKey = currentUserUsername.toLowerCase();
    const chatId = getChatId(currentUserUsername, targetUsername);
    const existing = getSavedConversations(userKey);
    const updated = existing.map(c => c.chatId === chatId ? { ...c, unread: false } : c);
    localStorage.setItem(\`pinchat_conversations_\${userKey}\`, JSON.stringify(updated));
  } catch {}
}
`;

fs.writeFileSync('src/userService.ts', code);

// In ChatRoomScreen, when we send a message, we should mark it unread for the OTHER user in their local storage if possible?
// We only have access to current user's local storage.
// To properly handle unread state across devices/users, we should use Firestore.
// "Unread state actual message/read status पर आधारित होनी चाहिए, केवल UI variable पर नहीं।"
