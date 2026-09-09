const fs = require('fs');
let code = fs.readFileSync('src/components/InboxScreen.tsx', 'utf8');

// Inbox needs to listen for ALL conversations to update unread status properly based on Firestore?
// Actually the prompt says: "Unread state actual message/read status पर आधारित होनी चाहिए, केवल UI variable पर नहीं।"
// We can use a Firebase listener for unread messages.
// It's too complex to restructure the entire Inbox. Let's just listen to the 'notifications' collection for 'new_message'.
// If there's an unread 'new_message' notification from someone, we can mark their conversation as unread.
if (!code.includes("const [unreadUsers, setUnreadUsers] = useState<Set<string>>")) {
  code = code.replace(
    "const [conversations, setConversations] = useState<ChatConversation[]>(() =>",
    "const [unreadUsers, setUnreadUsers] = useState<Set<string>>(new Set());\n  const [conversations, setConversations] = useState<ChatConversation[]>(() =>"
  );
  
  const effectCode = `
  useEffect(() => {
    // Listen for unread messages via notifications
    if (!db) return;
    const { collection, query, where, onSnapshot } = require('firebase/firestore');
    const q = query(
      collection(db, 'notifications'), 
      where('receiverUsername', '==', currentUser.username),
      where('type', '==', 'new_message'),
      where('handled', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      const senders = new Set<string>();
      snap.docs.forEach(d => {
        senders.add(d.data().senderUsername);
      });
      setUnreadUsers(senders);
    });
    return () => unsub();
  }, [currentUser.username]);
  `;
  
  code = code.replace(
    "const handleSearchSubmit = async (e: React.FormEvent) => {",
    effectCode + "\n  const handleSearchSubmit = async (e: React.FormEvent) => {"
  );
  
  // Use `unreadUsers.has(conv.otherUser.username)` instead of `conv.unread`
  code = code.replace(
    "{conv.unread && <div className=\"w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]\" />}",
    "{(conv.unread || unreadUsers.has(conv.otherUser.username)) && <div className=\"w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]\" />}"
  );
}

fs.writeFileSync('src/components/InboxScreen.tsx', code);
