const fs = require('fs');
let code = fs.readFileSync('src/components/ChatProfilePanel.tsx', 'utf8');

code = code.replace(
  "interface ChatProfilePanelProps {",
  "interface ChatProfilePanelProps {\n  isFriend?: boolean;\n  onAddFriend?: () => void;\n  onStartChat?: () => void;"
);

code = code.replace(
  "export const ChatProfilePanel: React.FC<ChatProfilePanelProps> = ({ targetUser, currentUser, onClose }) => {",
  "export const ChatProfilePanel: React.FC<ChatProfilePanelProps> = ({ targetUser, currentUser, onClose, isFriend, onAddFriend, onStartChat }) => {"
);

// Add the Add Friend / Start Chat buttons if callbacks are provided
// Search for "Stats Row" which is right after the avatar/header
const statsRowIndex = code.indexOf('{/* Stats Row */}');
const buttonsCode = `
        {/* Actions Row */}
        {(onAddFriend || onStartChat) && (
          <div className="flex gap-2 w-full mt-2">
            {onAddFriend && targetUser.username !== currentUser.username && (
              <button 
                onClick={onAddFriend}
                disabled={isFriend}
                className={\`flex-1 py-2.5 rounded-lg text-[11px] font-tech font-bold uppercase tracking-widest transition-colors \${isFriend ? 'bg-white/10 text-white/50 cursor-default' : 'bg-[#00E5FF] hover:bg-[#00E5FF]/80 text-black'}\`}
              >
                {isFriend ? 'Friends ✓' : 'Add Friend'}
              </button>
            )}
            {onStartChat && (
              <button 
                onClick={onStartChat}
                className="flex-1 py-2.5 rounded-lg bg-[#AFDDFF] hover:bg-white text-black text-[11px] font-tech font-bold uppercase tracking-widest transition-colors"
              >
                Start Chat
              </button>
            )}
          </div>
        )}
`;

code = code.replace(
  "{/* Stats Row */}",
  buttonsCode + "\n        {/* Stats Row */}"
);

fs.writeFileSync('src/components/ChatProfilePanel.tsx', code);
