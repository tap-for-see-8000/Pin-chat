const fs = require('fs');
let code = fs.readFileSync('src/components/InboxScreen.tsx', 'utf8');
code = code.replace(
  "import { db } from '../firebase';",
  "import { db } from '../firebase';\nimport { collection, query, where, onSnapshot } from 'firebase/firestore';"
);
code = code.replace(
  "const { collection, query, where, onSnapshot } = require('firebase/firestore');",
  ""
);
fs.writeFileSync('src/components/InboxScreen.tsx', code);
