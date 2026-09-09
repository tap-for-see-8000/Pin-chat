const fs = require('fs');
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

code = code.replace(
  'rounded-xl text-sm text-slate-800 placeholder:text-slate-500',
  'rounded-xl text-base text-slate-800 placeholder:text-slate-500'
);

fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);
