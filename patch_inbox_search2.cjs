const fs = require('fs');
let code = fs.readFileSync('src/components/InboxScreen.tsx', 'utf8');

if (!code.includes("import { ChatProfilePanel }")) {
  code = code.replace(
    "import { EmojiGatewayModal } from './EmojiGatewayModal';",
    "import { EmojiGatewayModal } from './EmojiGatewayModal';\nimport { ChatProfilePanel } from './ChatProfilePanel';\nimport { checkIsFriend, addFriend, createNotification } from '../services/appService';"
  );
}

// Add state for friend status and profile panel
if (!code.includes('const [isFoundUserFriend')) {
  code = code.replace(
    "const [foundUser, setFoundUser] = useState<PublicUserProfile | null>(null);",
    "const [foundUser, setFoundUser] = useState<PublicUserProfile | null>(null);\n  const [isFoundUserFriend, setIsFoundUserFriend] = useState(false);\n  const [viewingProfileOf, setViewingProfileOf] = useState<PublicUserProfile | null>(null);"
  );
}

// When found user changes, check friend status
code = code.replace(
  "setFoundUser(result.user);",
  "setFoundUser(result.user);\n        checkIsFriend(currentUser.username, result.user.username).then(setIsFoundUserFriend);"
);

// We want to open the profile when tapping the user card, but maybe the "Start Chat" button is fine.
// User requested: "Search Result -> User Profile -> Add Friend"
// Let's modify the found user card
code = code.replace(
  `<button \n                      onClick={() => handleInitiateChat(foundUser)}\n                      className="w-full py-3 bg-[#AFDDFF] hover:bg-white text-black font-tech font-bold uppercase tracking-widest rounded-md text-[11px] transition-all active:scale-95 z-10 mt-2"\n                    >\n                      Start Chat\n                    </button>`,
  `<button 
                      onClick={() => setViewingProfileOf(foundUser)}
                      className="w-full py-3 bg-[#AFDDFF] hover:bg-white text-black font-tech font-bold uppercase tracking-widest rounded-md text-[11px] transition-all active:scale-95 z-10 mt-2"
                    >
                      View Profile
                    </button>`
);

// Add the profile panel to Inbox
code = code.replace(
  "{/* Secret Emoji Gateway Interstitial Modal */}",
  `{/* Search Profile Panel Overlay */}
      <AnimatePresence>
        {viewingProfileOf && (
          <ChatProfilePanel 
            targetUser={viewingProfileOf} 
            currentUser={currentUser} 
            onClose={() => setViewingProfileOf(null)} 
            onStartChat={() => handleInitiateChat(viewingProfileOf)}
            isFriend={isFoundUserFriend}
            onAddFriend={async () => {
              if (viewingProfileOf.username === currentUser.username) return;
              await addFriend(currentUser.username, viewingProfileOf.username);
              await createNotification(viewingProfileOf.username, currentUser.username, 'friend_added');
              setIsFoundUserFriend(true);
            }}
          />
        )}
      </AnimatePresence>
      {/* Secret Emoji Gateway Interstitial Modal */}`
);

fs.writeFileSync('src/components/InboxScreen.tsx', code);
