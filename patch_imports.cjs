const fs = require('fs');

// ProfileScreen Fixes
let profileCode = fs.readFileSync('src/components/ProfileScreen.tsx', 'utf8');
profileCode = profileCode.replace(
  "import { updateUserProfile, saveGoalProgress, getWeeklyGoalProgress, getFriendCount, getGoalStats } from '../services/appService';",
  "import { getFriendCount, getGoalStats } from '../services/appService';\nimport { updateProfileData } from '../userService';"
);
profileCode = profileCode.replace('updateUserProfile(', 'updateProfileData(');

profileCode = profileCode.replace(
  "const [progress, count, stats] = await Promise.all([\n      getWeeklyGoalProgress(currentUser.username, dates),\n      getFriendCount(currentUser.username),\n      getGoalStats(currentUser.username)\n    ]);",
  "const [count, stats] = await Promise.all([\n      getFriendCount(currentUser.username),\n      getGoalStats(currentUser.username)\n    ]);\n    const progress = await getWeeklyGoalProgress(currentUser.username, dates);"
);

// We need getWeeklyGoalProgress and saveGoalProgress in ProfileScreen but they seem to be missing from appService.
// Wait, I overwrote them when I regexed appService? Let's check appService.ts
