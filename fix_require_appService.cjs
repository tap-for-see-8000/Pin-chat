const fs = require('fs');
let code = fs.readFileSync('src/services/appService.ts', 'utf8');
code = code.replace(
  "const { query, collection, where, getDocs } = require('firebase/firestore');",
  ""
);
code = code.replace(
  "const { doc, updateDoc } = require('firebase/firestore');",
  ""
);
fs.writeFileSync('src/services/appService.ts', code);
