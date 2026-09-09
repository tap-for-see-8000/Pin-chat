const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');
if (!code.includes("'chat_profile'")) {
  code = code.replace(
    `export type AppScreen = 'auth' | 'inbox' | 'chat' | 'mood' | 'weekly_report' | 'profile' | 'notifications';`,
    `export type AppScreen = 'auth' | 'inbox' | 'chat' | 'chat_profile' | 'mood' | 'weekly_report' | 'profile' | 'notifications';`
  );
  fs.writeFileSync('src/types.ts', code);
}
