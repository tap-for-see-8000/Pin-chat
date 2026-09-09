const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(
  "setRegData({...regData, mobile: e.target.value.replace(/D/g, '')})",
  "setMobileNumber(e.target.value.replace(/\\D/g, ''))"
);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
