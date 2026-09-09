const fs = require('fs');
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

// Replace standard form with motion.form
code = code.replace(
  '<form\n          onSubmit={(e) => e.preventDefault()}\n          className={`max-w-3xl mx-auto flex items-end gap-2 w-full transition-opacity ${(!isFriend && messages.length >= 10) ? \'opacity-50 pointer-events-none\' : \'\'}`}',
  `{/* Upward Trail Indicator */}\n        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-6 flex flex-col items-center pointer-events-none opacity-0 group-hover:opacity-40 transition-opacity">
          <div className="text-[8px] font-tech text-[#AFDDFF] uppercase tracking-[0.3em] mb-1">SWIPE TO TRANSMIT</div>
          <div className="w-0.5 h-6 bg-gradient-to-t from-[#AFDDFF]/40 to-transparent"></div>
        </div>\n        <motion.form
          onSubmit={(e) => e.preventDefault()}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.8, bottom: 0 }}
          onDragEnd={(e, info) => {
            if (info.offset.y < -40 && inputText.trim()) {
              handleSendMessage();
            }
          }}
          className={\`max-w-3xl mx-auto flex items-end gap-2 w-full transition-opacity group relative \${(!isFriend && messages.length >= 10) ? 'opacity-50 pointer-events-none' : ''}\`}`
);
code = code.replace('</form>', '</motion.form>');

// Remove the Send button
code = code.replace(
  /\s*{\/\* Send Button: Dedicated tap\/click to send \*\/}[\s\S]*?(?=<\/motion\.form>)/,
  '\n        '
);

// We need to import motion if not already imported
if (!code.includes("import { motion, AnimatePresence } from 'motion/react';") && code.includes("import { AnimatePresence } from 'motion/react';")) {
  code = code.replace(
    "import { AnimatePresence } from 'motion/react';",
    "import { motion, AnimatePresence } from 'motion/react';"
  );
} else if (!code.includes('motion/react')) {
  code = code.replace(
    "import React, { useState, useEffect, useRef } from 'react';",
    "import React, { useState, useEffect, useRef } from 'react';\nimport { motion, AnimatePresence } from 'motion/react';"
  );
}

fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);
