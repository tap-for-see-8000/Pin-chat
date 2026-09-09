const fs = require('fs');
let code = fs.readFileSync('src/services/appService.ts', 'utf8');

const additionalFunctions = `
export async function getGoalStats(username: string): Promise<{ streak: number, thirtyDayCount: number }> {
  // We'll calculate streak and 30-day progress by fetching the last 30 days of goalProgress
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().split('T')[0];
  });
  
  const progress = await getWeeklyGoalProgress(username, dates);
  
  let thirtyDayCount = 0;
  let streak = 0;
  
  // Count 30 days
  for (const date of dates) {
    if (progress[date]) {
      thirtyDayCount++;
    }
  }
  
  // Calculate current streak (working backwards from today)
  for (let i = dates.length - 1; i >= 0; i--) {
    const date = dates[i];
    if (progress[date]) {
      streak++;
    } else {
      // If today is missing, it's okay, maybe they haven't done it today yet, but if yesterday is missing, streak is 0.
      if (i === dates.length - 1) {
         // Today is missing, let's check yesterday
         continue;
      } else {
         break;
      }
    }
  }
  
  return { streak, thirtyDayCount };
}
`;

if (!code.includes('getGoalStats')) {
  code += additionalFunctions;
}

fs.writeFileSync('src/services/appService.ts', code);
