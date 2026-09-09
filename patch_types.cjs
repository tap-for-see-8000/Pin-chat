const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

// Add new fields to UserRecord and PublicUserProfile
code = code.replace(
  "personalGoal?: string;",
  "personalGoal?: string;\n  bio?: string;\n  goalHistory?: { [date: string]: boolean };\n  streak?: number;\n  thirtyDayProgress?: number;"
);

code = code.replace(
  "presence?: UserPresence;",
  "presence?: UserPresence;\n  bio?: string;\n  personalGoal?: string;\n  streak?: number;\n  thirtyDayProgress?: number;\n  friendCount?: number;"
);

if (!code.includes('SecretCapsule')) {
    code += `
export interface SecretCapsule {
  id: string;
  senderUsername: string;
  receiverUsername: string;
  message: string;
  unlockTime: number;
  createdAt: number;
  isUnlocked: boolean;
}
`;
}

fs.writeFileSync('src/types.ts', code);
