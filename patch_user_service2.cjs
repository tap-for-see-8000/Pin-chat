const fs = require('fs');
let code = fs.readFileSync('src/userService.ts', 'utf8');

code = code.replace(
  "} from 'firebase/firestore';",
  "  addDoc,\n} from 'firebase/firestore';"
);

fs.writeFileSync('src/userService.ts', code);
