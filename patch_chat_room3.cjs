const fs = require('fs');
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

if (!code.includes('import { ChatProfilePanel }')) {
  code = code.replace(
    "import { EmojiGatewayModal } from './EmojiGatewayModal';",
    "import { EmojiGatewayModal } from './EmojiGatewayModal';\nimport { ChatProfilePanel } from './ChatProfilePanel';"
  );
}

if (!code.includes('<ChatProfilePanel')) {
  code = code.replace(
    "{/* Upward Trail Indicator */}",
    `{/* Profile Panel Overlay */}
      <AnimatePresence>
        {showProfilePanel && (
          <ChatProfilePanel 
            targetUser={targetUser} 
            currentUser={currentUser} 
            onClose={() => setShowProfilePanel(false)} 
          />
        )}
      </AnimatePresence>
      {/* Upward Trail Indicator */}`
  );
}

fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);
