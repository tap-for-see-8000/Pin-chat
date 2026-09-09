const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');
code = code.replace(
  'export type FriendRequestStatus = \'pending\' | \'accepted\' | \'rejected\';',
  `export type NotificationType = 'friend_request';

export interface AppNotification {
  id: string;
  receiverUsername: string;
  senderUsername: string;
  type: NotificationType;
  relatedRequestId: string;
  isRead: boolean;
  handled: boolean;
  timestamp: number;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'declined';`
);
fs.writeFileSync('src/types.ts', code);
