const fs = require('fs');
let code = fs.readFileSync('src/components/EmojiGatewayModal.tsx', 'utf8');

code = code.replace('// Vertical drag={!isVerifying}', '// Vertical drag');

fs.writeFileSync('src/components/EmojiGatewayModal.tsx', code);
