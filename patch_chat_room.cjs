const fs = require('fs');
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

if (!code.includes('ChatProfilePanel')) {
  code = code.replace(
    "import { EmojiGatewayModal } from './EmojiGatewayModal';",
    "import { EmojiGatewayModal } from './EmojiGatewayModal';\nimport { ChatProfilePanel } from './ChatProfilePanel';"
  );
}

// Add state for profile panel
code = code.replace(
  "const [decoyInput, setDecoyInput] = useState('');",
  "const [decoyInput, setDecoyInput] = useState('');\n  const [showProfilePanel, setShowProfilePanel] = useState(false);"
);

// Add click handler to header to open profile
code = code.replace(
  `alt={targetUser.fullName}`,
  `alt={targetUser.fullName}`
);
code = code.replace(
  `<div className="flex items-center gap-3">
            <div className="relative shrink-0">`,
  `<div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowProfilePanel(true)}>
            <div className="relative shrink-0">`
);

// Implement composer upward swipe to send
code = code.replace(
  `{/* Message Composer */}`,
  `{/* Profile Panel Overlay */}
      <AnimatePresence>
        {showProfilePanel && (
          <ChatProfilePanel 
            targetUser={targetUser} 
            currentUser={currentUser} 
            onClose={() => setShowProfilePanel(false)} 
          />
        )}
      </AnimatePresence>\n      {/* Message Composer */}`
);

fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);
