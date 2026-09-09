const fs = require('fs');
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

code = code.replace(
  'className="w-full h-screen bg-transparent text-slate-800 flex flex-col justify-between select-none relative overflow-hidden"',
  'className="w-full h-[100dvh] bg-transparent text-slate-800 flex flex-col justify-between select-none relative overflow-hidden"'
);

fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);
