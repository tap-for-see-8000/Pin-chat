const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
if (!code.includes("currentScreen === 'chat_profile'")) {
  
  // Add ChatProfilePanel to App.tsx
  code = code.replace(
    "import { NotificationsScreen } from './components/NotificationsScreen';",
    "import { NotificationsScreen } from './components/NotificationsScreen';\nimport { ChatProfilePanel } from './components/ChatProfilePanel';"
  );
  
  // Provide navigate away for the profile
  code = code.replace(
    `export default function App() {`,
    `export default function App() {
  const handleOpenChatProfile = () => {
    setCurrentScreen('chat_profile');
  };
  `
  );

  code = code.replace(
    `{/* 8. Notifications Screen */}`,
    `{/* 9. Chat Profile Dedicated Screen */}
      {currentScreen === 'chat_profile' && currentUser && activeTargetUser && (
         <ChatProfilePanel 
           targetUser={activeTargetUser} 
           currentUser={currentUser} 
           onClose={() => setCurrentScreen('chat')} 
         />
      )}
      {/* 8. Notifications Screen */}`
  );
  
  // Add the prop to ChatRoomScreen
  code = code.replace(
    `          targetUser={activeTargetUser}
          onBack={handleBackToInbox}
        />`,
    `          targetUser={activeTargetUser}
          onBack={handleBackToInbox}
          onOpenProfile={handleOpenChatProfile}
        />`
  );

  fs.writeFileSync('src/App.tsx', code);
}
