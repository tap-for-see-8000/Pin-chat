const fs = require('fs');

// We need to add notification bell logic to InboxScreen if it's not there.
let code = fs.readFileSync('src/components/InboxScreen.tsx', 'utf8');
if (!code.includes("const [hasUnreadNotifs")) {
  code = code.replace(
    "const [unreadUsers, setUnreadUsers] = useState<Set<string>>(new Set());",
    "const [unreadUsers, setUnreadUsers] = useState<Set<string>>(new Set());\n  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false);\n  const [showNotifs, setShowNotifs] = useState(false);"
  );
  
  // Listen for notifications
  code = code.replace(
    "setUnreadUsers(senders);",
    "setUnreadUsers(senders);\n      setHasUnreadNotifs(snap.docs.length > 0);"
  );
  
  // Add Notification Bell
  code = code.replace(
    `<button
            onClick={() => setIsSearchModalOpen(true)}
            className="w-10 h-10 rounded-xl bg-black border border-white/20 flex items-center justify-center text-[#AFDDFF] hover:bg-white/10 transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>`,
    `<button
            onClick={() => setShowNotifs(true)}
            className="w-10 h-10 rounded-xl bg-black border border-white/20 flex items-center justify-center text-[#AFDDFF] hover:bg-white/10 transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            {hasUnreadNotifs && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
          </button>
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="w-10 h-10 rounded-xl bg-black border border-white/20 flex items-center justify-center text-[#AFDDFF] hover:bg-white/10 transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>`
  );
  
  code = code.replace(
    "import { EmojiGatewayModal } from './EmojiGatewayModal';",
    "import { EmojiGatewayModal } from './EmojiGatewayModal';\nimport { NotificationsScreen } from './NotificationsScreen';\nimport { Bell } from 'lucide-react';"
  );
  
  code = code.replace(
    "{/* Search Profile Panel Overlay */}",
    `{/* Notifications Overlay */}
      <AnimatePresence>
        {showNotifs && (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="absolute inset-0 z-50 bg-[#000000]">
            <NotificationsScreen currentUser={currentUser} onBack={() => setShowNotifs(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Search Profile Panel Overlay */}`
  );
  fs.writeFileSync('src/components/InboxScreen.tsx', code);
}
