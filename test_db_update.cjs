const fs = require('fs');
let code = fs.readFileSync('src/userService.ts', 'utf8');

// Ensure updateProfileData has photo edit
if (!code.includes("avatarUrl?: string;")) {
  // wait we just pass updates which is Partial<UserRecord>
}

fs.writeFileSync('src/userService.ts', code);
