const fs = require('fs');
let code = fs.readFileSync('src/components/ProfileScreen.tsx', 'utf8');

code = code.replace(
  "import { getFriendCount, getGoalStats } from '../services/appService';",
  "import { getFriendCount, getGoalStats, getWeeklyGoalProgress, saveGoalProgress } from '../services/appService';"
);

fs.writeFileSync('src/components/ProfileScreen.tsx', code);
