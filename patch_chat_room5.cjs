const fs = require('fs');
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

if (!code.includes("import { ChatProfilePanel }")) {
  code = code.replace(
    "import { LiveLocationRadar } from './LiveLocationRadar';",
    "import { LiveLocationRadar } from './LiveLocationRadar';\nimport { ChatProfilePanel } from './ChatProfilePanel';"
  );
}

fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);
