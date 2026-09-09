const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(/onChange=\{handleFileChange\}/g, 'onChange={handleImageFileChange}');

fs.writeFileSync('src/components/AuthScreen.tsx', code);
