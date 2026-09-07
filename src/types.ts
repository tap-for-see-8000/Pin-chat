/**
 * PIN Chat - Core TypeScript Definitions
 * Package / Identifier: com.aistudio.pinchat.kpmd
 */

export interface UserProfile {
  uid: string;
  displayName: string;
  mobileNumber: string; // 10 digits [PRIVATE]
  villageCity: string;  // [PRIVATE]
  pinCode: string;      // 6 digits [PRIVATE]
  authProvider: 'anonymous';
  createdAt: number;
  updatedAt: number;
}

export type RelationshipMode = 'Dost' | 'GF/BF' | 'Wife/Husband' | 'Dost+GF';
export type TargetGender = 'Male' | 'Female' | 'Other';
export type RegionalLanguage = 'Hindi' | 'Hinglish' | 'Bhojpuri';

export interface RoomAiConfig {
  enabled: boolean;
  relationshipMode: RelationshipMode;
  targetGender: TargetGender;
  language: RegionalLanguage;
  isNewConnection: boolean;
  autoReply: boolean;
}

export interface Room {
  pin: string; // 6-char uppercase alphanumeric
  createdBy: string; // uid
  memberCount: number; // Max 2
  createdAt: number;
  aiConfig: RoomAiConfig;
}

export interface RoomMember {
  uid: string;
  displayName: string;
  joinedAt: number;
}

export type PersonaType = 'Friend' | 'Wife / Partner' | 'Professional Assistant' | 'Casual Buddy';

export interface Message {
  messageId: string;
  senderUid: string;
  senderName: string;
  text: string;
  createdAt: number;
  isAi?: boolean;
  status?: 'sent' | 'delivered';
}

export type AppScreen =
  | 'splash'
  | 'profile'
  | 'home'
  | 'create-chat'
  | 'join-chat'
  | 'chat'
  | 'raj-settings';
