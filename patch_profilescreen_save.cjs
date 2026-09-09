const fs = require('fs');

let code = fs.readFileSync('src/components/ProfileScreen.tsx', 'utf8');

code = code.replace(
  `    await updateProfileData(currentUser.username, { 
      fullName, 
      bio, 
      personalGoal,
      streak, // Update current streak on user record so friends can see
      thirtyDayProgress: thirtyDayCount
    });`,
  `    await updateProfileData(currentUser.username, { 
      fullName, 
      bio, 
      personalGoal,
      avatarUrl,
      streak, // Update current streak on user record so friends can see
      thirtyDayProgress: thirtyDayCount
    });`
);

fs.writeFileSync('src/components/ProfileScreen.tsx', code);
