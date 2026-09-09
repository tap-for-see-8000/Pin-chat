const fs = require('fs');
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

// Add onOpenProfile to interface
if (!code.includes("onOpenProfile?: () => void;")) {
  code = code.replace(
    "onBack: () => void;",
    "onBack: () => void;\n  onOpenProfile?: () => void;"
  );
}

// Add to props destructuring
code = code.replace(
  "onBack,",
  "onBack,\n  onOpenProfile,"
);

// Remove local state profile modal
code = code.replace(
  "const [showProfilePanel, setShowProfilePanel] = useState(false);",
  ""
);

// Replace onClick handler
code = code.replace(
  /onClick=\{\(\) => setShowProfilePanel\(true\)\}/g,
  "onClick={() => onOpenProfile?.()}"
);

// Remove ChatProfilePanel from inside ChatRoomScreen
code = code.replace(
  /<AnimatePresence>\s*\{typeof showProfilePanel !== 'undefined' && showProfilePanel && \(\s*<ChatProfilePanel[\s\S]*?\/>\s*\)\}\s*<\/AnimatePresence>/g,
  ""
);
code = code.replace(
  /<AnimatePresence>\s*\{showProfilePanel && \(\s*<ChatProfilePanel[\s\S]*?\/>\s*\)\}\s*<\/AnimatePresence>/g,
  ""
);

fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);
