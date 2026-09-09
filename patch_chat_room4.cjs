const fs = require('fs');
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

if (!code.includes("from 'motion/react'")) {
  code = code.replace(
    "import React, { useState, useRef, useEffect, useCallback } from 'react';",
    "import React, { useState, useRef, useEffect, useCallback } from 'react';\nimport { motion, AnimatePresence } from 'motion/react';"
  );
}

fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);
