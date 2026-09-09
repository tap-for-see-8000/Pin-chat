const fs = require('fs');
let code = fs.readFileSync('src/services/appService.ts', 'utf8');

code = code.replace(
  `import {
  MoodRecord,
  MoodType,
  FriendRequest,
  Friendship,
  GoalProgressRecord,
  UserRecord
} from '../types';`,
  `import {
  MoodRecord,
  MoodType,
  FriendRequest,
  Friendship,
  GoalProgressRecord,
  UserRecord,
  AppNotification
} from '../types';`
);

fs.writeFileSync('src/services/appService.ts', code);
