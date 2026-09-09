const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(
  "export type NotificationType = 'friend_request';",
  "export type NotificationType = 'friend_added' | 'new_message';"
);

// We can leave FriendRequest interfaces in case we miss a spot that breaks, but it's better to clean. Let's just update AppNotification
code = code.replace(
  "relatedRequestId: string;",
  "relatedRequestId?: string;"
);

fs.writeFileSync('src/types.ts', code);
