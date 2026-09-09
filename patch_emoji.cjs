const fs = require('fs');
let code = fs.readFileSync('src/components/EmojiGatewayModal.tsx', 'utf8');

code = code.replace(/drag\n/g, 'drag={!isVerifying}\n');

fs.writeFileSync('src/components/EmojiGatewayModal.tsx', code);
