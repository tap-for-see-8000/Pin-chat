/**
 * PIN Chat - Core TypeScript Definitions
 * Package / Identifier: com.aistudio.pinchat.kpmd
 */

export interface UserRecord {
  username: string; // e.g. "mohit8976" (Firestore document ID under 'users')
  password: string; // e.g. "mohit9876"
  fullName: string; // e.g. "Mohit Yadav"
  mobileNumber: string; // 10 digits
  villageCity: string;  // गांव / शहर
  pinCode: string;      // 6 digits
  createdAt: number;
  updatedAt: number;
}

// Real-time user online presence
export interface UserPresence {
  isOnline: boolean;
  lastSeen: number;
}

// Public user profile when searched (never reveals password or private mobile)
export interface PublicUserProfile {
  username: string;
  fullName: string;
  villageCity?: string;
  pinCode?: string;
  presence?: UserPresence;
}

export type AutoReplyStyle = 'friend' | 'casual' | 'supportive' | 'professional';
export type PersonaType = 'Friend' | 'Wife / Partner' | 'Professional Assistant' | 'Casual Buddy';

export interface AutoReplySettingItem {
  enabled: boolean;
  style: AutoReplyStyle;
}

export interface ChatMessage {
  messageId: string;
  chatId: string;
  senderUsername: string;
  senderName: string;
  text: string;
  createdAt: number;
  isAi?: boolean;
  isAIMessage?: boolean;
  messageSource?: 'user_input' | 'ai_auto_reply';
  aiProcessingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  status?: 'sent' | 'delivered' | 'seen';
  seenAt?: number;
  deletedForEveryone?: boolean;
}

// Room / ChatSession with Auto-Reply settings & memory summary
export interface ChatSession {
  chatId: string;
  participants: string[];
  participantNames?: { [username: string]: string };
  autoReplySettings?: {
    [username: string]: AutoReplySettingItem;
  };
  memorySummary?: string;
  summaryUpToTimestamp?: number;
  typingStatus?: {
    [username: string]: boolean;
  };
  lastMessageText?: string;
  lastMessageTime?: number;
  updatedAt?: number;
}

// Conversation summary for Instagram-style Inbox
export interface ChatConversation {
  chatId: string;
  otherUser: PublicUserProfile;
  lastMessageText: string;
  lastMessageTime: number;
  unread?: boolean;
  autoReplySettings?: {
    [username: string]: AutoReplySettingItem;
  };
}

export interface DecoyMessage {
  id: string;
  sender: string;
  service: 'Amazon' | 'Zomato' | 'BlueDart' | 'Delhivery' | 'Support' | 'You';
  text: string;
  time: string;
  isUser?: boolean;
  badge?: string;
}

export type AppScreen = 'auth' | 'inbox' | 'chat';
