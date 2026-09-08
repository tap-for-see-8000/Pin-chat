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
  gender: 'male' | 'female';
  avatarUrl: string;
  createdAt: number;
  updatedAt: number;
}

// Real-time user online presence
export interface UserPresence {
  isOnline: boolean;
  lastSeen: number;
}

// Public user profile when searched (never reveals password or full private mobile)
export interface PublicUserProfile {
  username: string;
  fullName: string;
  phone?: string;
  mobileNumber?: string;
  villageCity?: string;
  gender?: 'male' | 'female';
  avatarUrl?: string;
  presence?: UserPresence;
  createdAt?: number;
}

export type AutoReplyStyle = 'friend' | 'casual' | 'supportive' | 'professional';
export type PersonaType = 'Friend' | 'Wife / Partner' | 'Professional Assistant' | 'Casual Buddy';

export type PersonalityRelationship =
  | 'unknown'
  | 'friend'
  | 'close_friend'
  | 'family'
  | 'classmate'
  | 'acquaintance'
  | 'professional'
  | 'supportive';

export type PersonalityLanguage =
  | 'auto'
  | 'hindi'
  | 'hinglish'
  | 'english'
  | 'bhojpuri'
  | 'regional';

export type PersonalityTone =
  | 'casual'
  | 'friendly'
  | 'respectful'
  | 'supportive'
  | 'professional'
  | 'playful'
  | 'direct';

export type PersonalityFormality = 'low' | 'medium' | 'high';
export type PersonalityBrevity = 'short' | 'normal' | 'detailed';
export type PersonalityEmojiFrequency = 'off' | 'low' | 'normal' | 'high';
export type PersonalityCommunicationStyle =
  | 'simple'
  | 'chatty'
  | 'playful'
  | 'calm'
  | 'direct'
  | 'supportive';

export interface PerChatPersonality {
  relationship: PersonalityRelationship;
  language: PersonalityLanguage;
  dialect?: string;
  tone: PersonalityTone;
  formality: PersonalityFormality;
  brevity: PersonalityBrevity;
  emojiFrequency: PersonalityEmojiFrequency;
  communicationStyle: PersonalityCommunicationStyle;
}

export interface AutoReplySettingItem {
  enabled: boolean;
  style: AutoReplyStyle;
  personality?: PerChatPersonality;
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

export interface LocationUserCoordinate {
  lat: number;
  lng: number;
  updatedAt: number;
}

export interface LocationSession {
  status: 'idle' | 'requested' | 'active';
  requestedBy: string;
  activeUsers: {
    [username: string]: LocationUserCoordinate;
  };
}

// Phase 3: Per-Chat Conversation Memory Data Structures
export interface MemoryFactItem {
  id: string;
  speaker: 'partner' | 'currentUser' | 'third_party';
  speakerName?: string;
  topic: string; // e.g. 'exam', 'schedule', 'preference', 'family', 'work', 'location'
  fact: string; // concise statement, e.g. "Has a Physics exam tomorrow"
  timestamp: number;
  confidence: 'high' | 'medium';
  isTemporary?: boolean;
  expiresAt?: number;
  cancelled?: boolean;
}

export interface PerChatConversationMemory {
  chatId: string;
  updatedAt: number;
  recentContext?: string; // ongoing immediate topic
  conversationSummary?: string; // concise rolling summary of relationship & chat
  importantFacts?: MemoryFactItem[]; // verified stable facts with speaker attribution
  communicationStyle?: string; // e.g. "prefers short replies, casual Hinglish"
  languagePreference?: string; // e.g. "Hinglish"
  relationshipContext?: string; // e.g. "Classmate / close friend"
  temporaryContext?: string; // e.g. "Going to market today" (time-bound)
  temporaryContextExpiresAt?: number;
  userPreferences?: string[];
}

// Phase 4: Smart Context Management Types
export interface SmartContextDialogueItem {
  senderName: string;
  text: string;
  isCurrentUser: boolean;
  isImmediate?: boolean;
  isRelevantOlder?: boolean;
  relevanceScore?: number;
}

export interface SmartContextSelection {
  selectedDialogue: SmartContextDialogueItem[];
  immediateContext: SmartContextDialogueItem[];
  isShortFollowUp: boolean;
  hasPronouns: boolean;
  isTopicSwitched: boolean;
  detectedTopic?: string;
  prunedMemoryDirective: string;
}

// Phase 5: Response Validation & Quality Control Types
export type ValidationIssueType =
  | 'empty'
  | 'technical_language'
  | 'bot_identity'
  | 'wrong_target'
  | 'context_mismatch'
  | 'hallucination'
  | 'language_mismatch'
  | 'dialect_mismatch'
  | 'length_mismatch'
  | 'personality_mismatch'
  | 'memory_misuse'
  | 'context_misuse'
  | 'unnatural_response'
  | 'contradiction'
  | 'repetition'
  | 'speaker_confusion'
  | 'prefix';

export interface ValidationIssue {
  type: ValidationIssueType;
  reason: string;
}

export interface ValidationResult {
  isValid: boolean;
  primaryIssue?: ValidationIssueType;
  reason?: string;
  issues: ValidationIssue[];
  sanitizedReply: string;
  qualityScore?: number; // Internal quality score, never shown to user
}

// Room / ChatSession with Auto-Reply settings & memory summary
export interface ChatSession {
  chatId: string;
  participants: string[];
  participantNames?: { [username: string]: string };
  locationSession?: LocationSession;
  autoReplySettings?: {
    [username: string]: AutoReplySettingItem;
  };
  memorySummary?: string;
  summaryUpToTimestamp?: number;
  conversationMemory?: PerChatConversationMemory;
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
