const fs = require('fs');
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

code = code.replace(
  "const [inputText, setInputText] = useState('');",
  "const [inputText, setInputText] = useState('');\n  const [showProfilePanel, setShowProfilePanel] = useState(false);"
);

if (!code.includes('import { motion')) {
  code = code.replace(
    "import React, { useState, useEffect, useRef } from 'react';",
    "import React, { useState, useEffect, useRef } from 'react';\nimport { motion, AnimatePresence } from 'motion/react';"
  );
}

fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);
