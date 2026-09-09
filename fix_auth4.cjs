const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(/setShowPassword/g, 'setShowLoginPassword');

fs.writeFileSync('src/components/AuthScreen.tsx', code);
