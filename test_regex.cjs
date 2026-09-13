const fs = require('fs');
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');
const oldMicEndRegex = /  const handleMicClick = \(\) => \{[\s\S]*?(?=  \/\/ 7\. Send Message Handler|  \/\/ Location Radar Toggle)/;
const match = code.match(oldMicEndRegex);
if (match) {
  console.log("Matched length:", match[0].length);
  console.log("Starts with:", match[0].substring(0, 50));
} else {
  console.log("No match!");
}
