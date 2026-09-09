/**
 * PIN Chat - Stealth AI Auto-Reply Engine
 * Package: com.aistudio.pinchat.kpmd
 * 
 * Technical Implementation:
 * 1. Strict Eligibility & Anti-Loop Pipeline Trigger Filters
 * 2. 2.5s Multi-Message Debounce per chatId
 * 3. 3-Layer Context Assembly (Memory Summary, Chronological History, Target Messages)
 * 4. Human Texting Persona with Strict Anti-Bot Rules & Language Mirroring
 * 5. Generation Config: temperature = 0.7, maxOutputTokens = 60
 * 6. Multi-stage Output Sanitizer & Natural Human Fallback Engine
 * 7. Stealth Typing & Human Timing Engine (2.2s - 6.8s delay)
 * 8. Atomic Database Commit & Safe Finally Cleanup
 */

import { GoogleGenAI } from '@google/genai';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  ChatMessage,
  AutoReplyStyle,
  PublicUserProfile,
  ChatSession,
  PerChatPersonality,
  PersonalityRelationship,
  PersonalityLanguage,
  PersonalityTone,
  PersonalityFormality,
  PersonalityBrevity,
  PersonalityEmojiFrequency,
  PersonalityCommunicationStyle,
  PerChatConversationMemory,
  MemoryFactItem,
  SmartContextDialogueItem,
  SmartContextSelection,
  ValidationIssueType,
  ValidationIssue,
  ValidationResult,
} from '../types';
import { saveConversationItem } from '../userService';

export interface AutoReplyTriggerConfig {
  message: ChatMessage;
  chatId: string;
  currentUsername: string;
  currentFullName: string;
  targetUser: PublicUserProfile;
  settings: {
    enabled: boolean;
    style: AutoReplyStyle;
    personality?: PerChatPersonality;
  };
  onMessageCommitted?: (newMsg: ChatMessage) => void;
  onTargetStatusUpdated?: (targetMsgId: string, status: 'completed' | 'failed') => void;
  onTypingChange?: (isTyping: boolean) => void;
}

interface PendingChatDebounce {
  timer: NodeJS.Timeout;
  messages: ChatMessage[];
  config: AutoReplyTriggerConfig;
}

// In-memory debounce timers and message bundles isolated per chatId
const debounceStore = new Map<string, PendingChatDebounce>();

// Track messages currently in-flight to prevent duplicate execution
const inFlightMessageIds = new Set<string>();

// PHASE 6: Track recently processed message IDs (LRU-style capped Set) to prevent duplicate processing
const processedMessageIds = new Set<string>();
const MAX_PROCESSED_MESSAGE_HISTORY = 400;

export function markMessageProcessed(messageId: string): void {
  if (!messageId) return;
  if (processedMessageIds.size >= MAX_PROCESSED_MESSAGE_HISTORY) {
    const oldest = processedMessageIds.values().next().value;
    if (oldest) processedMessageIds.delete(oldest);
  }
  processedMessageIds.add(messageId);
}

export function isMessageProcessed(messageId: string): boolean {
  return processedMessageIds.has(messageId);
}

// PHASE 6: In-memory short-lived chat metadata cache to eliminate redundant Firestore getDoc reads during bursts
interface CachedChatMeta {
  chatData: ChatSession;
  cachedAt: number;
}
const chatMetaCache = new Map<string, CachedChatMeta>();
const CHAT_META_CACHE_TTL_MS = 10000; // 10s per-chat TTL strictly isolated per chatId

export function getCachedChatData(chatId: string): ChatSession | null {
  const cached = chatMetaCache.get(chatId);
  if (cached && Date.now() - cached.cachedAt < CHAT_META_CACHE_TTL_MS) {
    return cached.chatData;
  }
  return null;
}

export function setCachedChatData(chatId: string, chatData: ChatSession): void {
  chatMetaCache.set(chatId, {
    chatData,
    cachedAt: Date.now(),
  });
}

export function invalidateChatCache(chatId: string): void {
  chatMetaCache.delete(chatId);
}

/**
 * 1. PIPELINE TRIGGER FILTER (MUST RUN FIRST)
 * Returns false immediately if message is not eligible for auto-reply.
 */
export function checkMessageEligibility(
  message: ChatMessage,
  currentUsername: string,
  settings?: { enabled: boolean; style: AutoReplyStyle }
): boolean {
  // Phase 6: Empty, whitespace-only, or invalid messages never trigger AI
  if (!message || !message.text || !message.text.trim()) {
    return false;
  }

  const cleanCurrentUser = (currentUsername || '').trim().toLowerCase();
  const cleanSender = (message.senderUsername || '').trim().toLowerCase();

  // 1. Never reply to own messages (Right-aligned / Current user)
  if (cleanSender === cleanCurrentUser) {
    return false;
  }

  // 2. Anti-Loop Guard: Never reply to AI-generated messages
  if (message.isAIMessage === true || message.messageSource === 'ai_auto_reply') {
    return false;
  }

  // 3. Settings Guard: Stop if auto-reply is disabled for current user
  if (!settings || settings.enabled === false) {
    return false;
  }

  // 4. Duplicate Lock: Stop if already processing or completed
  if (
    message.aiProcessingStatus === 'processing' ||
    message.aiProcessingStatus === 'completed'
  ) {
    return false;
  }

  // Phase 6: Stop if already in-flight or previously processed
  if (inFlightMessageIds.has(message.messageId) || processedMessageIds.has(message.messageId)) {
    return false;
  }

  return true;
}

/**
 * 2. FAST MULTI-MESSAGE DEBOUNCE (2.5s per chatId)
 * Bundles rapid consecutive incoming messages from the partner into a single target context.
 */
export function enqueueIncomingMessageForAutoReply(config: AutoReplyTriggerConfig): void {
  const { message, chatId, currentUsername, settings } = config;

  if (!checkMessageEligibility(message, currentUsername, settings)) {
    return;
  }

  inFlightMessageIds.add(message.messageId);

  const existing = debounceStore.get(chatId);
  if (existing) {
    clearTimeout(existing.timer);
    existing.messages.push(message);
    existing.config = config; // Keep latest config
    existing.timer = setTimeout(() => {
      executeAutoReplyPipeline(chatId);
    }, 2500);
  } else {
    const timer = setTimeout(() => {
      executeAutoReplyPipeline(chatId);
    }, 2500);

    debounceStore.set(chatId, {
      timer,
      messages: [message],
      config,
    });
  }
}

/**
 * 3. EXECUTE AUTO-REPLY PIPELINE
 */
async function executeAutoReplyPipeline(chatId: string): Promise<void> {
  const pending = debounceStore.get(chatId);
  if (!pending) return;

  debounceStore.delete(chatId);

  const { messages: targetMessages, config } = pending;
  const {
    currentUsername,
    currentFullName,
    targetUser,
    settings,
    onMessageCommitted,
    onTargetStatusUpdated,
    onTypingChange,
  } = config;

  const cleanCurrentUser = currentUsername.trim().toLowerCase();
  const cleanPartnerUser = targetUser.username.trim().toLowerCase();
  const partnerName = targetUser.fullName || targetUser.username;
  const channelName = `pinchat_channel_${chatId}`;

  // Broadcast typing helper
  const setTypingState = async (isTyping: boolean) => {
    try {
      if (onTypingChange) {
        onTypingChange(isTyping);
      }

      // Broadcast to local tabs
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const ch = new BroadcastChannel(channelName);
          ch.postMessage({
            type: 'typing_status',
            username: cleanCurrentUser,
            senderName: currentFullName,
            isTyping,
          });
          ch.close();
        } catch {
          // ignore
        }
      }

      // Update Firestore typing status
      if (db) {
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, {
          [`typingStatus.${cleanCurrentUser}`]: isTyping,
        }).catch(() => {});

        const typingDocRef = doc(db, 'chats', chatId, 'typing', cleanCurrentUser);
        await setDoc(
          typingDocRef,
          {
            isTyping,
            username: cleanCurrentUser,
            senderName: currentFullName,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  // Mark all target messages as 'processing'
  for (const m of targetMessages) {
    m.aiProcessingStatus = 'processing';
    if (db) {
      try {
        const mRef = doc(db, 'chats', chatId, 'messages', m.messageId);
        updateDoc(mRef, { aiProcessingStatus: 'processing' }).catch(() => {});
      } catch {
        // ignore
      }
    }
  }

  // Activate Stealth Typing Indicator on behalf of current user
  await setTypingState(true);

  try {
    // LAYER A: Long-Term Memory Summary, Per-Chat Memory & Personality from Firestore
    let memorySummary = '';
    let remoteMemory: PerChatConversationMemory | undefined = undefined;
    let remotePersonality: PerChatPersonality | undefined = undefined;
    if (db) {
      try {
        // Phase 6: In-memory short-lived chat metadata cache to eliminate redundant reads during bursts
        let chatData = getCachedChatData(chatId);
        if (!chatData) {
          const chatDocRef = doc(db, 'chats', chatId);
          const chatSnap = await getDoc(chatDocRef);
          if (chatSnap.exists()) {
            chatData = chatSnap.data() as ChatSession;
            setCachedChatData(chatId, chatData);
          }
        }
        if (chatData) {
          if (chatData.memorySummary) {
            memorySummary = chatData.memorySummary;
          }
          if (chatData.conversationMemory) {
            remoteMemory = chatData.conversationMemory;
          }
          if (chatData.autoReplySettings?.[cleanCurrentUser]?.personality) {
            remotePersonality = chatData.autoReplySettings[cleanCurrentUser].personality;
          }
        }
      } catch (err) {
        console.warn('[AutoReplyEngine] Memory summary read note:', err);
      }
    }

    // Resolve isolated per-chat personality for this specific generation
    const localSettings = getChatAutoReplySettings(chatId, currentUsername);
    const perChatPersonality = resolvePerChatPersonality(
      settings.style,
      settings.personality || remotePersonality || localSettings.personality
    );

    // Resolve isolated per-chat conversation memory (prunes expired temporary facts & context)
    const perChatMemory = resolvePerChatMemory(chatId, remoteMemory, memorySummary);
    const formattedMemoryDirective = formatMemoryForContext(perChatMemory, partnerName, currentFullName);

    // Target Unanswered Messages from Partner
    const targetIds = new Set(targetMessages.map((m) => m.messageId));
    const bundledPartnerText = targetMessages.map((m) => m.text).join('\n').trim();

    // LAYER B: Recent 35 Chronological Messages (Excluding the target incoming messages)
    const recentDialogue: Array<{ senderName: string; text: string; isCurrentUser: boolean }> = [];
    if (db) {
      try {
        const messagesColl = collection(db, 'chats', chatId, 'messages');
        const q = query(messagesColl, orderBy('createdAt', 'desc'), limit(35));
        const snap = await getDocs(q);

        const fetched: ChatMessage[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (!targetIds.has(d.id)) {
            fetched.push({
              messageId: d.id,
              chatId,
              senderUsername: data.senderUsername || '',
              senderName: data.senderName || '',
              text: data.text || '',
              createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
            });
          }
        });

        // Reverse to chronological order (oldest to newest)
        fetched.reverse();

        fetched.forEach((m) => {
          recentDialogue.push({
            senderName: m.senderName || m.senderUsername,
            text: m.text,
            isCurrentUser: m.senderUsername.trim().toLowerCase() === cleanCurrentUser,
          });
        });
      } catch (err) {
        console.warn('[AutoReplyEngine] History fetch note:', err);
      }
    }

    // 4. PHASE 4: SMART CONTEXT MANAGEMENT & SELECTION
    const smartContext = selectSmartConversationContext({
      recentDialogue,
      bundledPartnerText,
      partnerName,
      currentFullName,
      perChatMemory,
      formattedMemoryDirective,
    });

    // 5. ADVANCED LANGUAGE & DIALECT DETECTION & PER-CHAT PERSONALITY (PHASE 8 MULTILINGUAL)
    const recentContextTextForLang = smartContext.selectedDialogue.map(d => d.text).join(' ');
    const detectedDialect = detectMessageDialect(bundledPartnerText, recentContextTextForLang);
    const lengthDirective = computeLengthDirective(bundledPartnerText);

    // PHASE 6: CONTEXT, PERSONALITY & REQUEST OPTIMIZATION LAYER
    const optimized = optimizeAIContext({
      currentMessage: bundledPartnerText,
      immediateContext: smartContext.immediateContext,
      recentDialogue,
      selectedDialogue: smartContext.selectedDialogue,
      memoryDirective: smartContext.prunedMemoryDirective,
      personality: perChatPersonality,
      detectedDialect,
      partnerName,
      currentFullName,
    });

    console.debug(
      `[AutoReplyEngine:Optimized] Context Messages: ${optimized.metrics.selectedMessageCount}/${optimized.metrics.totalInputMessages} | Est. Tokens: ~${optimized.metrics.estimatedTokens} | Facts: ${optimized.metrics.memoryFactsCount} | Deduped: ${optimized.metrics.dedupCount}`
    );

    const styleProfiles: Record<AutoReplyStyle, string> = {
      friend: 'Warm, relaxed, witty, and authentic friendly texting vibe.',
      casual: 'Laid-back, chill, very brief, everyday texting tone.',
      supportive: 'Thoughtful, caring, empathetic, warm, and attentive.',
      professional: 'Polite, clear, helpful, courteous, without being stiff or robotic.',
    };

    const chosenStyleDescription = styleProfiles[settings.style] || styleProfiles.friend;

    const systemInstruction = `You are a real human texting as ${currentFullName} (@${currentUsername}) to ${partnerName} (@${cleanPartnerUser}) on a personal messaging smartphone app.

==================== CORE IDENTITY & PERSONA ====================
- Act completely like a real person texting back quickly and casually.
- Style Category: ${chosenStyleDescription}
- Sound 100% natural, spontaneous, relaxed, and conversational.
- Never sound like a chatbot, customer support agent, or AI assistant.

${optimized.compactPersonalityDirective}

==================== SMART CONTEXT & MEMORY PRIORITY HIERARCHY (PHASE 4 & 6) ====================
- CONTEXT PRIORITY ORDER:
  1. Priority 1 — Current Incoming Message (HIGHEST PRIORITY: what you must answer right now!)
  2. Priority 2 — Immediate Context (the 2 to 4 messages immediately preceding this incoming message)
  3. Priority 3 — Recent Conversation (the ongoing active conversational flow)
  4. Priority 4 — Relevant Older Messages (meaningful older context only if directly related)
  5. Priority 5 — Per-Chat Memory (background facts verified for this chat)
  6. Priority 6 — Per-Chat Personality
  7. Priority 7 — Core AI Behavior Rules

- IMMEDIATE CONTEXT & SHORT FOLLOW-UP HANDLING:
${smartContext.isShortFollowUp ? `* CRITICAL: ${partnerName}'s message is a short query or follow-up question ("${bundledPartnerText}"). You MUST connect it directly to the immediate preceding messages right above it to know what ${partnerName} is asking about!` : '* If partner asks a follow-up or short question, interpret it using immediate preceding messages.'}
${smartContext.hasPronouns ? `* NOTE: The incoming message contains reference pronouns. Look directly at the immediate preceding messages to determine who or what is being referred to.` : ''}

- TOPIC CONTINUITY VS TOPIC SWITCHING:
${smartContext.isTopicSwitched ? `* CRITICAL: The topic of conversation has switched. Focus 100% on the new active topic (${smartContext.detectedTopic || 'current discussion'}). Do NOT mention or drag in old, dead topics!` : '* Follow the current active conversational topic smoothly.'}

- CONFLICT RESOLUTION:
* Immediate and recent conversation ALWAYS and 100% overrides older memory or older messages! If a plan was changed, cancelled, or updated recently, the latest state strictly wins. Never cling to cancelled or superseded facts!

- VERIFIED BACKGROUND MEMORY (DEDUPLICATED & CONFLICT-RESOLVED):
${optimized.optimizedMemoryDirective ? optimized.optimizedMemoryDirective : '- (No previous background memory; chat naturally based on current messages)'}

- SPEAKER ATTRIBUTION DISCIPLINE:
  Strictly respect who said or did what. If ${partnerName}'s brother has an exam, do NOT assume ${partnerName} or ${currentFullName} has an exam.

- ABSOLUTE BAN ON MEMORY HALLUCINATION:
  NEVER invent or claim past memories that do not exist in this chat's memory or history. If you don't recall or lack info, give a natural human reply: "Yaad nahi abhi", "Nahi pata yaar", "Sure nahi hu".

- ZERO BOT META-TALK:
  NEVER use words like "memory", "database", "system", "context", or "saved". Everything works internally in your head just like a real human remembers things.

==================== CRITICAL TWO-SIDED CONVERSATION TARGETING ====================
- You are reading BOTH sides of the dialogue to understand the situation.
- ALWAYS generate a response ONLY to ${partnerName}'s latest incoming message at the very end of the chat.
- NEVER reply to ${currentFullName}'s own previous messages as if they were questions asked to you.
- Your own past messages are strictly background context so you know what you previously said.

==================== RELATIONSHIP SAFETY CONSTRAINT ====================
- DO NOT invent, assume, or guess an intimate or specific personal relationship (e.g., do NOT assume the partner is your romantic partner, spouse, sibling, or boss) unless this is clearly and unambiguously established in the conversation history or explicitly set in the personality profile.
- If relationship is unknown, maintain a friendly, balanced, natural conversational tone appropriate for a neutral acquaintance.

==================== STRICT LENGTH & BREVITY RULE ====================
- ${lengthDirective}
- Default behavior must be SHORT, NATURAL, and PUNCHY.
- NEVER write essays, paragraphs, bullet points, numbered lists, or unnecessary explanations.

==================== ZERO-CONTEXT / NEW CHAT RESILIENCE ====================
- If conversation history is empty or this is a brand new chat, do NOT be confused and NEVER apologize.
- Answer greetings or ice-breakers immediately and naturally:
  * "Hi" / "Hii" / "Hello" -> "Heyy" or "Haan bol"
  * "Kaha ho?" -> "Ghar pe hu" or "Ghar pe"
  * "Kya kar rahe?" -> "Bas baitha hu"
  * "Aur batao" -> "Bas badhiya, tu bata"
  * "Free ho?" -> "Haan bol na"

==================== FACTUAL GROUNDING & UNCERTAINTY ====================
- Do NOT invent fake locations, fake commitments, or fabricated events unless mentioned in the chat.
- If you lack information or don't know the exact answer:
  Respond naturally like a friend: "Yaad nahi abhi", "Nahi pata yaar", "Pata nahi bhai", "Shayad", "Abhi sure nahi", "Dekhna padega".
- NEVER make up facts, and NEVER give technical excuses.

==================== PHASE 8: MULTILINGUAL & MEANING MATCHING ====================
- LANGUAGE & SCRIPT SEPARATION: Do NOT assume Roman script (English alphabet) means the language is English. Understand the meaning!
- HINDI/HINGLISH DETECTION: "Tum kaha ho?", "Kya kar rahe ho?", "Aaj school gaye the?" are Roman Hindi (Hinglish). You MUST reply in natural Roman Hindi/Hinglish (e.g. "Ghar pe hu"). NEVER reply to Hinglish with pure English like "I am at home".
- DEVANAGARI HINDI: If partner writes "तुम क्या कर रहे हो?", reply in Devanagari Hindi (e.g. "बस घर पे हूँ").
- PURE ENGLISH: If partner writes "Where are you?", reply in English (e.g. "At home").
- NATURAL MIRRORING: Mirror the conversational language style of the current message and recent chat, unless personality overrides.
- DO NOT artificially mix English and Hindi unless it's natural slang.

==================== PHASE 8: REPETITION CONTROL & CONTINUITY ====================
- NEVER repeat the exact same response or question if you have already answered it or asked it recently.
- Pay attention to your own previous replies in the context. If you already said "Ghar pe hu", do not say it again unless strictly necessary.
- MEANING-LEVEL REPETITION: Do not ask the same question using different words if the answer is known or already asked (e.g., if you asked "Tum kaha ho?", don't ask "Abhi home par ho?").
- PROGRESSION: Move the conversation forward naturally. Focus on the current intent of the user.

==================== ABSOLUTE BOT LANGUAGE BAN (STRICTLY FORBIDDEN) ====================
- NEVER mention or hint that you are an AI, bot, assistant, machine, system, or automated program.
- ZERO tolerance for system, loading, or technical phrases. NEVER use any of these or similar words:
  * "Context nahi mila" / "Context samajh nahi aaya" / "Context nahi hai" / "No context"
  * "Thodi der me connect ho jayega" / "Connect ho raha hai" / "Connecting" / "Connection"
  * "Mai yahi hu dekh raha hu" / "Main check kar raha hu" / "System check kar raha hu"
  * "Processing ho rahi hai" / "Processing" / "Loading" / "Request process"
  * "Chat history nahi mili" / "History available nahi hai" / "Data load"
  * "Assistant" / "AI" / "Bot" / "Model" / "API" / "Server" / "Database" / "System" / "Backend" / "Frontend"
  * "Please wait" / "Kripya pratiksha karein" / "As an AI..." / "Main samajhne ki koshish kar raha hu"
- Output ONLY the raw human message text. Do NOT wrap in quotation marks. Do NOT prepend speaker names.

==================== NATURAL FEW-SHOT CONVERSATION PATTERNS ====================
(Reference patterns only; do not repeat blindly, adapt naturally to context):
- Partner: "Hi" -> Reply: "Heyy"
- Partner: "Kaha ho?" -> Reply: "Ghar pe"
- Partner: "Kya kar rahe?" -> Reply: "Bas baitha hu"
- Partner: "Aur batao" -> Reply: "Bas badhiya, tu bata"
- Partner: "Kal aaoge?" -> Reply: "Haan aaunga"
- Partner: "Free ho abhi?" -> Reply: "Haan bol"
- Partner: "कहाँ हो?" -> Reply: "घर पे हूँ"
- Partner: "क्या कर रहे हो?" -> Reply: "कुछ नहीं बस बैठा हूँ"
- Partner: "का हाल बा?" -> Reply: "सब बढ़िया बा, आपन बतावा"
- Partner: "का करताड़?" -> Reply: "बस बइठल बानी"
- Partner: "Where are you?" -> Reply: "At home, what's up?"
- Partner: "What's up?" -> Reply: "Not much, you?"`;

    let generatedReply = '';

    const apiKey =
      (import.meta.env.VITE_GEMINI_API_KEY as string) ||
      (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '') ||
      '';

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        // Phase 6: Build optimized, compact alternating conversation turns for Gemini
        const contents = optimized.optimizedDialogue;

        const response = await ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
            maxOutputTokens: 60,
          },
        });

        const rawOutput = response.text?.trim() || '';

        // PHASE 5: SANITIZE & VALIDATE DRAFT
        const sanitized = sanitizeReplyText(
          rawOutput,
          partnerName,
          currentFullName,
          currentUsername,
          perChatPersonality
        );

        const validation = validateReplyQuality({
          replyText: sanitized,
          incomingText: bundledPartnerText,
          partnerName,
          currentFullName,
          currentUsername,
          personality: perChatPersonality,
          style: settings.style,
          recentDialogue,
          smartContext,
          memoryDirective: optimized.optimizedMemoryDirective,
        });

        if (validation.isValid) {
          generatedReply = sanitized;
        } else {
          // PHASE 5 SELF-CORRECTION: Exactly 1 targeted retry to prevent infinite loops
          console.warn(
            `[AutoReplyEngine] Draft failed Phase 5 validation (${validation.primaryIssue}: ${validation.reason}). Initiating targeted self-correction...`
          );

          const correctiveInstruction = `${systemInstruction}

==================== PHASE 5: SELF-CORRECTION DIRECTIVE ====================
CRITICAL: Your previous draft was REJECTED by quality validation because:
- Quality Issue: ${validation.reason}
- Rejected Draft: "${sanitized}"

CORRECTION MANDATES:
1. Fix the identified issue above directly and strictly.
2. Provide a natural, direct, 2-to-6 word human texting response to ${partnerName}'s message: "${bundledPartnerText}".
3. No bot phrases, no prefixes, no contradictions, match dialect, stay strictly on-topic.
4. Output ONLY the corrected reply message text.`;

          try {
            const retryResponse = await ai.models.generateContent({
              model: 'gemini-1.5-flash',
              contents: optimized.optimizedDialogue,
              config: {
                systemInstruction: correctiveInstruction,
                temperature: 0.7,
                maxOutputTokens: 60,
              },
            });

            const retryRaw = retryResponse.text?.trim() || '';
            const retrySanitized = sanitizeReplyText(
              retryRaw,
              partnerName,
              currentFullName,
              currentUsername,
              perChatPersonality
            );

            const retryValidation = validateReplyQuality({
              replyText: retrySanitized,
              incomingText: bundledPartnerText,
              partnerName,
              currentFullName,
              currentUsername,
              personality: perChatPersonality,
              style: settings.style,
              recentDialogue,
              smartContext,
              memoryDirective: optimized.optimizedMemoryDirective,
            });

            if (retryValidation.isValid) {
              generatedReply = retrySanitized;
            } else {
              console.warn(
                `[AutoReplyEngine] Self-correction retry also failed validation (${retryValidation.primaryIssue}: ${retryValidation.reason}). Falling back to safe smart fallback.`
              );
            }
          } catch (retryErr) {
            console.warn('[AutoReplyEngine] Self-correction retry note:', retryErr);
          }
        }
      } catch (geminiErr) {
        console.warn('[AutoReplyEngine] Gemini generation note:', geminiErr);
      }
    }

    // Smart contextual fallback if API key is missing or failed (Never dry generic filler or bot phrases)
    if (!generatedReply) {
      const recentAiReplies = recentDialogue
        .filter((d) => d.isCurrentUser)
        .map((d) => d.text);

      generatedReply = generateSmartFallbackReply(
        bundledPartnerText,
        settings.style,
        partnerName,
        perChatPersonality,
        recentAiReplies
      );
    }

    // 5. HUMAN RESPONSE TIMING: Insert random delay between 2.2s and 6.8s (e.g. 2.4s, 3.8s, 5.1s)
    const randomDelayMs = Math.floor(Math.random() * (6800 - 2200 + 1)) + 2200;
    await new Promise((r) => setTimeout(r, randomDelayMs));

    // 6. DATABASE COMMIT:
    const messageId = `msg-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();

    const newReplyMessage: ChatMessage = {
      messageId,
      chatId,
      senderUsername: currentUsername,
      senderName: currentFullName,
      text: generatedReply,
      createdAt: now,
      isAi: true,
      isAIMessage: true,
      messageSource: 'ai_auto_reply',
      status: 'delivered',
    };

    // Save reply message in Firestore
    if (db) {
      try {
        const msgDocRef = doc(db, 'chats', chatId, 'messages', messageId);
        await setDoc(msgDocRef, {
          messageId,
          chatId,
          senderUsername: currentUsername,
          senderName: currentFullName,
          text: generatedReply,
          createdAt: serverTimestamp(),
          isAi: true,
          isAIMessage: true,
          messageSource: 'ai_auto_reply',
          status: 'delivered',
        });
      } catch (err) {
        console.warn('[AutoReplyEngine] Firestore message write note:', err);
      }
    }

    // Atomically mark target incoming messages as completed
    for (const m of targetMessages) {
      m.aiProcessingStatus = 'completed';
      markMessageProcessed(m.messageId);
      if (onTargetStatusUpdated) {
        onTargetStatusUpdated(m.messageId, 'completed');
      }

      if (db) {
        try {
          const targetRef = doc(db, 'chats', chatId, 'messages', m.messageId);
          updateDoc(targetRef, { aiProcessingStatus: 'completed' }).catch(() => {});
        } catch {
          // ignore
        }
      }
    }

    // Save conversation item for Inbox preview
    saveConversationItem(currentUsername, targetUser, generatedReply, now);

    // Broadcast new message across tabs
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const ch = new BroadcastChannel(channelName);
        ch.postMessage({
          type: 'new_message',
          message: newReplyMessage,
        });
        ch.close();
      } catch {
        // ignore
      }
    }

    if (onMessageCommitted) {
      onMessageCommitted(newReplyMessage);
    }

    // Phase 3: Trigger Asynchronous Per-Chat Memory Update (Non-blocking)
    triggerBackgroundMemoryUpdate({
      chatId,
      currentUsername,
      currentFullName,
      partnerUsername: cleanPartnerUser,
      partnerName,
      partnerText: bundledPartnerText,
      replyText: generatedReply,
      existingMemory: perChatMemory,
      recentDialogue,
    }).catch((memErr) => {
      console.warn('[AutoReplyEngine] Background memory update note:', memErr);
    });
  } catch (error) {
    console.error('[AutoReplyEngine] Error processing auto-reply:', error);
    // Mark target messages as failed
    for (const m of targetMessages) {
      m.aiProcessingStatus = 'failed';
      if (onTargetStatusUpdated) {
        onTargetStatusUpdated(m.messageId, 'failed');
      }
    }
  } finally {
    // STRICT RESET: Always reset typingStatus in finally block to prevent stuck indicators
    await setTypingState(false);
    for (const m of targetMessages) {
      inFlightMessageIds.delete(m.messageId);
    }
  }
}

/**
 * Language & Dialect Detection Interface
 */
export interface DetectedDialect {
  code: 'bhojpuri' | 'hindi' | 'hinglish' | 'english';
  name: string;
  guidelines: string;
}

/**
 * Accurately detects partner's dialect and conversational register:
 * Bhojpuri, Devanagari Hindi, Casual English, or Everyday Hinglish.
 */
export function detectMessageDialect(text: string, recentContextText: string = ''): DetectedDialect {
  const clean = (text || '').trim();
  const lower = clean.toLowerCase();
  
  // Phase 8: If current text is very short/neutral, mix in recent context for language inference
  const isShortOrNeutral = clean.split(/\s+/).length <= 2 && /^(ok|hmm|nice|wow|oh|achha|cool|k|bro|dude|yaar|yes|no|yep|nope|haan|na|hi|hey|hello|bye)$/i.test(clean);
  const textToAnalyze = isShortOrNeutral && recentContextText.length > 0 ? `${clean} ${recentContextText}` : clean;
  const lowerToAnalyze = textToAnalyze.toLowerCase();

  // Bhojpuri markers in Devanagari script or Latin transliteration
  const bhojpuriDevanagari = [
    'बाड़',
    'बानी',
    'करताड़',
    'का हाल बा',
    'का भईल',
    'कहाँ बाड़',
    'रउआ',
    'तहार',
    'तोहार',
    'घरे',
    'बइठल',
    'बइल',
    'करेम',
    'जाएम',
    'का बात बा',
    'हमनी',
    'राउर',
    'का करत',
  ];
  const bhojpuriLatin = [
    'baada',
    'baani',
    'bani',
    'bada',
    'karat bada',
    'karat baani',
    'ka haal ba',
    'ka bhail',
    'kahan baada',
    'kahan bada',
    'ghare',
    'tohar',
    'raur',
    'ka baat ba',
    'baadu',
    'baatas',
  ];

  const isBhojpuri =
    bhojpuriDevanagari.some((w) => textToAnalyze.includes(w)) ||
    bhojpuriLatin.some((w) => lowerToAnalyze.includes(w));

  if (isBhojpuri) {
    return {
      code: 'bhojpuri',
      name: 'Bhojpuri / Regional Dialect',
      guidelines: `Partner wrote in Bhojpuri. Reply STRICTLY in authentic, conversational Bhojpuri (e.g., 'घरे बानी', 'सब ठीक बा, आपन बतावा', 'का बात बा?', 'बस बइठल बानी'). Do NOT reply in English or formal Hindi.`,
    };
  }

  // Devanagari Hindi
  const hasDevanagari = /[\u0900-\u097F]/.test(textToAnalyze);
  if (hasDevanagari) {
    return {
      code: 'hindi',
      name: 'Devanagari Hindi',
      guidelines: `Partner wrote in Devanagari Hindi script. Reply STRICTLY in natural, casual Devanagari Hindi (e.g., 'घर पे हूँ', 'बस बैठा हूँ, तुम बताओ', 'हाँ बोलो'). Do NOT reply in Roman/English script or overly formal Sanskritized Hindi.`,
    };
  }

  // Pure English detection (Latin characters without common Hinglish marker words)
  const hinglishMarkers = [
    'kaha',
    'kahan',
    'kidhar',
    'kya',
    'bhai',
    'yaar',
    'bata',
    'aur',
    'suno',
    'sun',
    'theek',
    'thik',
    'hai',
    'babu',
    'batao',
    'achha',
    'acha',
    'sab',
    'haan',
    'nahi',
    'aaj',
    'kal',
    'chal',
    'kuch',
    'kaise',
    'kab',
    'bol',
    'mera',
    'tera',
    'hum',
    'tum',
    'karo',
    'karein',
  ];
  const hasHinglish = hinglishMarkers.some((m) =>
    new RegExp(`\\b${m}\\b`, 'i').test(lowerToAnalyze)
  );
  const isEnglish = !hasHinglish && /^[a-z0-9\s.,!?'"()_@#%&-]+$/i.test(textToAnalyze);

  if (isEnglish) {
    return {
      code: 'english',
      name: 'Casual Modern English',
      guidelines: `Partner wrote in English. Reply in brief, natural, modern texting English (e.g., 'At home, what\\'s up?', 'Nothing much, you?', 'Yeah tell me', 'Sounds good'). Do NOT use stiff, corporate, or formal English.`,
    };
  }

  // Default: Natural Conversational Hinglish
  return {
    code: 'hinglish',
    name: 'Natural Conversational Hinglish',
    guidelines: `Partner wrote in Hinglish (Roman Hindi). Reply in natural, casual everyday Hinglish (e.g., 'Ghar pe hu', 'Bas baitha hu, tu bata', 'Haan bol', 'Kya hua?'). Do NOT use unnatural pure English or complex bookish phrasing.`,
  };
}

/**
 * Computes strict length mirroring directive based on incoming word count
 */
export function computeLengthDirective(partnerText: string): string {
  const words = (partnerText || '').trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount <= 2) {
    return `INCOMING IS ULTRA-SHORT (${wordCount} word${wordCount === 1 ? '' : 's'}).
STRICT RULE: Reply in 1 to 4 words maximum.
Examples: "Heyy", "Ghar pe", "Haan bol", "Bas baitha hu", "Bol na".
NEVER write a full sentence, explanation, or paragraph!`;
  }
  if (wordCount <= 6) {
    return `INCOMING IS SHORT (${wordCount} words).
STRICT RULE: Reply in 2 to 7 words maximum.
Examples: "Bas baitha hu, tu bata", "Ghar pe hu, bol", "Haan aaunga", "Abhi sure nahi".
Keep it punchy, casual, and brief.`;
  }
  if (wordCount <= 14) {
    return `INCOMING IS MEDIUM (${wordCount} words).
STRICT RULE: Reply in 4 to 12 words. Answer the question directly without filler.`;
  }
  return `INCOMING IS DETAILED (${wordCount} words).
STRICT RULE: Reply in 10 to 22 words maximum. Answer clearly and naturally, but NEVER write an essay, multiple paragraphs, or bullet points.`;
}


/**
 * PHASE 5: COMPREHENSIVE FORBIDDEN BOT & TECHNICAL PATTERNS
 */
export const FORBIDDEN_BOT_PATTERNS: RegExp[] = [
  // Context excuses
  /context\s*(nahi\s*mila|nahi\s*hai|samajh\s*nahi|unavailable|missing)/i,
  /mujhe\s*context/i,
  /no\s*context/i,
  /lack\s*(of\s*)?context/i,
  /don'?t\s*have\s*(enough\s*)?context/i,
  /chat\s*history\s*(nahi|unavailable|missing)/i,
  /history\s*(nahi\s*mili|available\s*nahi)/i,
  /pichhla\s*(record|context|chat)/i,

  // Connection / Processing / Loading excuses
  /thodi\s*der\s*m[eai]n?\s*connect/i,
  /connect\s*(ho\s*jayega|karte\s*hain|ho\s*raha)/i,
  /connection\s*(ho\s*raha|bana\s*raha|check)/i,
  /\bconnecting\b/i,
  /\bloading\b/i,
  /\bprocessing\b/i,
  /\bgenerating\b/i,
  /process\s*(ho\s*rahi|kar\s*raha)/i,
  /request\s*process/i,
  /system\s*check/i,
  /m[aai]\s*yahi\s*hu\s*dekh\s*raha/i,
  /m[aai]\s*yahi\s*hu\s*dekh\s*rahi/i,
  /main\s*check\s*kar\s*raha/i,
  /main\s*samajhne\s*ki\s*koshish/i,
  /trying\s*to\s*understand/i,
  /kripya\s*(pratiksha|wait)/i,
  /please\s*wait/i,

  // System & Architecture terms
  /\bassistant\b/i,
  /\bvirtual\s*assistant\b/i,
  /\bai\s*(model|system|bot|response)?\b/i,
  /\bbot\b/i,
  /\blanguage\s*model\b/i,
  /\bllm\b/i,
  /\bprompt\b/i,
  /\bserver\b/i,
  /\bdatabase\b/i,
  /\bapi\b/i,
  /\bbackend\b/i,
  /\bfrontend\b/i,
  /\balgorithm\b/i,
  /\bfunction\s*call\b/i,
  /\btoken\s*limit\b/i,
  /\bdata\s*load\b/i,
  /\bconversation\s*load\b/i,
  /\bmemory\s*system\b/i,
  /meri\s*memory/i,
  /mere\s*(memory|database|record|system)\s*(me|ke|se)/i,
  /memory\s*(me\s*save|update|check|search)/i,
  /saved\s*in\s*(my\s*)?memory/i,
  /according\s*to\s*my\s*(memory|records?)/i,
  /in\s*my\s*(database|system|memory)/i,
  /pichle\s*mahine\s*tumne\s*(kaha|bataya)/i,
  /\btechnical\s*issue\b/i,
  /\berror\b/i,
  /as\s*an\s*ai/i,
  /i\s*am\s*an\s*ai/i,
  /mai\s*(ek\s*)?(ai|bot|assistant)/i,
  /can\s*you\s*provide\s*more\s*(information|context|details)/i,
];

/**
 * PHASE 5: SANITIZATION ENGINE
 * Cleans raw output from model:
 * - Strips wrapping quotes ("...", '...', “...”, «...», `...`)
 * - Strips AI / sender prefixes ("AI:", "Assistant:", "Bot:", "Reply:", "Response:", "Answer:", etc.)
 * - Strips numbered lists and bullet points at the beginning
 * - Strips markdown (*, _, ~, `, #)
 * - Strips emojis if personality emojiFrequency is 'off'
 */
export function sanitizeReplyText(
  rawText: string,
  partnerName: string,
  currentFullName: string,
  currentUsername: string,
  personality?: PerChatPersonality
): string {
  if (!rawText) return '';

  let cleaned = rawText.trim();

  // 1. Remove wrapping quotes ("...", '...', “...”, «...», `...`)
  cleaned = cleaned.replace(/^["'“”«»`]+|["'“”«»`]+$/g, '').trim();

  // 2. Remove common AI/speaker prefixes like "AI:", "Assistant:", "Bot:", "Reply:", "Response:", "Answer:", "Suman:", "@username:"
  const prefixRegex = new RegExp(
    `^(?:${escapeRegex(currentFullName)}|${escapeRegex(currentUsername)}|${escapeRegex(partnerName)}|assistant|ai|bot|model|me|you|system|reply|response|answer|user|partner)\\s*:\\s*`,
    'i'
  );
  cleaned = cleaned.replace(prefixRegex, '').trim();

  // 3. Remove numbered lists or bullet points at start (e.g. "1. ", "- ", "* ")
  cleaned = cleaned.replace(/^(\d+\.|\-|\*|\•)\s*/, '').trim();

  // 4. Remove markdown formatting like **bold**, *italics*, `code`, # headings
  cleaned = cleaned.replace(/[*_~`#]/g, '').trim();

  // 5. Remove wrapping quotes again if newly exposed after prefix removal
  cleaned = cleaned.replace(/^["'“”«»`]+|["'“”«»`]+$/g, '').trim();

  // 6. Strip emojis if personality emojiFrequency is 'off'
  if (personality?.emojiFrequency === 'off') {
    cleaned = cleaned
      .replace(
        /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu,
        ''
      )
      .trim();
  }

  // 7. Collapse excess whitespace
  cleaned = cleaned.replace(/[ \t]+/g, ' ').trim();

  return cleaned;
}

export interface ValidationParams {
  replyText: string;
  incomingText: string;
  partnerName: string;
  currentFullName: string;
  currentUsername: string;
  personality: PerChatPersonality;
  style: AutoReplyStyle;
  recentDialogue: Array<{ senderName: string; text: string; isCurrentUser: boolean }>;
  smartContext?: SmartContextSelection;
  memoryDirective?: string;
}

/**
 * PHASE 5: MULTI-DIMENSIONAL RESPONSE QUALITY VALIDATOR
 * Runs comprehensive, deterministic local quality control before sending/saving any reply.
 */
export function validateReplyQuality(params: ValidationParams): ValidationResult {
  const {
    replyText,
    incomingText,
    partnerName,
    currentFullName,
    personality,
    style,
    recentDialogue,
    smartContext,
    memoryDirective,
  } = params;

  const issues: ValidationIssue[] = [];
  const text = (replyText || '').trim();
  const lowerReply = text.toLowerCase();
  const lowerIncoming = (incomingText || '').trim().toLowerCase();

  // A. EMPTY CHECK
  if (!text) {
    return {
      isValid: false,
      primaryIssue: 'empty',
      reason: 'Generated reply is empty or whitespace only',
      issues: [{ type: 'empty', reason: 'Empty reply' }],
      sanitizedReply: text,
      qualityScore: 0,
    };
  }

  // B. PREFIX CHECK
  if (/^(?:ai|assistant|bot|reply|response|answer|model|system)\s*:\s*/i.test(text)) {
    issues.push({
      type: 'prefix',
      reason: 'Contains unremoved bot prefix label',
    });
  }

  // C. TECHNICAL LANGUAGE CHECK (Forbidden phrases)
  for (const pattern of FORBIDDEN_BOT_PATTERNS) {
    if (pattern.test(text)) {
      issues.push({
        type: 'technical_language',
        reason: `Matched forbidden technical/bot pattern: ${pattern}`,
      });
      break;
    }
  }

  // D. BOT IDENTITY CHECK
  const BOT_IDENTITY_PATTERNS = [
    /\b(as an ai|i am an ai|i'm an ai|being an ai|virtual assistant)\b/i,
    /\b(mai|main)\s*(ek\s*)?(ai|bot|virtual assistant)\s*(hu|hoon)\b/i,
    /\b(i cannot feel|i don't have feelings|i lack emotions)\b/i,
    /\b(is there anything else i can help|how can i assist you today)\b/i,
  ];
  for (const pat of BOT_IDENTITY_PATTERNS) {
    if (pat.test(text)) {
      issues.push({
        type: 'bot_identity',
        reason: 'Reply reveals or claims AI/bot identity',
      });
      break;
    }
  }

  // E. WRONG TARGET & SPEAKER CONFUSION
  // Addressing current user's own name instead of the conversation partner
  if (currentFullName && currentFullName.trim().length > 1) {
    const selfNameRegex = new RegExp(
      `^(?:hey|hi|hello|haan|are|arrey)?\\s*${escapeRegex(currentFullName.trim())}\\b`,
      'i'
    );
    if (selfNameRegex.test(text)) {
      issues.push({
        type: 'wrong_target',
        reason: `Reply addresses the current user (${currentFullName}) instead of conversation partner (${partnerName})`,
      });
    }
  }

  // F. CONTRADICTION CHECK
  // Partner says they cannot come / plan cancelled -> AI says let's meet tomorrow / see you tomorrow
  const partnerCancellation =
    /(nahi\s*aa\s*(paunga|paungi|raha|rahi|sakta|sakti)|plan\s*cancel|drop\s*kar\s*diya|cannot\s*come|can't\s*come|not\s*coming|plan\s*cancelled)/i.test(
      lowerIncoming
    );
  const aiAgreesToMeet =
    /(haan\s*kal\s*milte\s*hain|kal\s*milenge|theek\s*hai\s*kal\s*(chalenge|milte|aana)|see\s*you\s*tomorrow|sure\s*let'?s\s*meet)/i.test(
      lowerReply
    );

  if (partnerCancellation && aiAgreesToMeet) {
    issues.push({
      type: 'contradiction',
      reason: 'Reply agrees to meet or says see you tomorrow when partner stated they cannot come / plan is cancelled',
    });
  }

  // Partner says they dislike something -> AI says it is partner's favorite
  if (
    /(mujhe\s*(nahi|ni)\s*pasand|don'?t\s*like|nafrat\s*hai)/i.test(lowerIncoming) &&
    /(tumhara\s*favorite|tumhe\s*(to\s*)?pasand\s*hai|you\s*love\s*it)/i.test(lowerReply)
  ) {
    issues.push({
      type: 'contradiction',
      reason: 'Reply contradicts partner expressing dislike for something',
    });
  }

  // G. REPETITION CHECK
  // Check against the last 2 AI messages in recentDialogue
  if (recentDialogue && recentDialogue.length > 0) {
    const recentAiTexts = recentDialogue
      .filter((d) => d.isCurrentUser)
      .slice(-2)
      .map((d) => d.text.trim().toLowerCase().replace(/[.,!?'"~`]/g, ''));

    const normalizedReply = lowerReply.replace(/[.,!?'"~`]/g, '').trim();
    if (recentAiTexts.includes(normalizedReply) && normalizedReply.length > 1) {
      issues.push({
        type: 'repetition',
        reason: `Reply repeats previous AI output: "${text}"`,
      });
    }
  }

  // H. LENGTH MISMATCH (Phase 1 Length Mirroring)
  const incomingWords = lowerIncoming.split(/\s+/).filter(Boolean).length;
  const replyWords = text.split(/\s+/).filter(Boolean).length;

  if (incomingWords <= 2 && replyWords > 10) {
    issues.push({
      type: 'length_mismatch',
      reason: `Incoming message has ${incomingWords} words, but reply has ${replyWords} words (exceeds 10 words)`,
    });
  } else if (incomingWords <= 4 && replyWords > 22) {
    issues.push({
      type: 'length_mismatch',
      reason: `Incoming message has ${incomingWords} words, but reply has ${replyWords} words (exceeds 22 words)`,
    });
  } else if (replyWords > 45 && personality.brevity !== 'detailed') {
    issues.push({
      type: 'length_mismatch',
      reason: `Reply exceeds maximum chat length budget (${replyWords} words)`,
    });
  }

  // I. LANGUAGE & DIALECT MISMATCH
  const incomingHasDevanagari = /[\u0900-\u097F]/.test(incomingText);
  const incomingIsBhojpuri =
    incomingText.includes('बाड़') ||
    incomingText.includes('बानी') ||
    incomingText.includes('करताड़') ||
    incomingText.includes('का हाल बा') ||
    incomingText.includes('कहाँ बा') ||
    incomingText.includes('का भईल') ||
    lowerIncoming.includes('baada') ||
    lowerIncoming.includes('baani') ||
    lowerIncoming.includes('ka haal ba') ||
    lowerIncoming.includes('ka karat');

  // If partner wrote in Bhojpuri and reply is stiff English
  if (incomingIsBhojpuri) {
    const isEnglishReply =
      /^[a-z0-9\s.,!?'"()_-]+$/i.test(text) &&
      !['baada', 'baani', 'bani', 'bada', 'ghare', 'bhojpuri', 'bhai', 'yaar', 'haan', 'nahi'].some(
        (w) => lowerReply.includes(w)
      );
    if (isEnglishReply) {
      issues.push({
        type: 'dialect_mismatch',
        reason: 'Partner wrote in Bhojpuri, but reply is purely in English',
      });
    }
  }

  // If partner wrote in Devanagari Hindi and reply is pure English
  if (incomingHasDevanagari && personality.language !== 'english') {
    const replyHasDevanagari = /[\u0900-\u097F]/.test(text);
    if (!replyHasDevanagari && /^[a-z0-9\s.,!?'"()_-]+$/i.test(text)) {
      issues.push({
        type: 'language_mismatch',
        reason: 'Partner wrote in Devanagari script, but reply is pure English script',
      });
    }
  }

  // Stiff formal English reply to casual Hinglish ("Kaha ho?" -> "I am currently at my residence")
  const isCasualHinglishQuery = [
    'kaha ho',
    'kaha hai',
    'kidhar ho',
    'kya kar rahe',
    'kya scene',
    'kaise ho',
  ].some((k) => lowerIncoming.includes(k));
  if (isCasualHinglishQuery) {
    const isStiffFormalEnglish =
      /(currently\s*at\s*my\s*residence|presently\s*residing|at\s*my\s*domicile)/i.test(
        lowerReply
      );
    if (isStiffFormalEnglish) {
      issues.push({
        type: 'language_mismatch',
        reason: 'Stiff, unnatural formal English used in response to casual Hinglish message',
      });
    }
  }

  // J. PERSONALITY MISMATCH
  if (personality.formality === 'high' || style === 'professional') {
    if (
      /(\boye\s*bro\b|\bbhaii\b|\blmao\b|\bkya\s*scene\b|\byo\s*bro\b)/i.test(lowerReply) ||
      /[😂🤣]/.test(text)
    ) {
      issues.push({
        type: 'personality_mismatch',
        reason: 'Used informal street slang or laughing emojis in a professional/high-formality personality',
      });
    }
  } else if (personality.formality === 'low' || style === 'casual') {
    if (
      /(dear\s*(sir|madam)|please\s*be\s*advised|kindly\s*find|yours\s*sincerely|acknowledge\s*receipt)/i.test(
        lowerReply
      )
    ) {
      issues.push({
        type: 'personality_mismatch',
        reason: 'Used stiff corporate boilerplate in casual/low-formality personality',
      });
    }
  }

  // K. CONTEXT MISMATCH & TOPIC SWITCHING
  if (smartContext?.isTopicSwitched) {
    const deadKeywords = ['physics', 'exam', 'paper', 'marks', 'syllabus'];
    const currentTopicKeywords = ['phone', 'samsung', 'camera', 'iphone', 'laptop'];
    const hasDead = deadKeywords.some((w) => lowerReply.includes(w));
    const isIncomingPhone = currentTopicKeywords.some((w) => lowerIncoming.includes(w));
    if (hasDead && isIncomingPhone) {
      issues.push({
        type: 'context_mismatch',
        reason: 'Brought up old dead topic after a confirmed topic switch',
      });
    }
  }

  // Direct follow-up query mismatch (e.g. Partner: "Kaunsi [movie]?", Reply: "Physics ka exam hai")
  if (
    lowerIncoming === 'kaunsi?' ||
    lowerIncoming === 'kaunsi' ||
    lowerIncoming === 'which one?' ||
    lowerIncoming === 'which one'
  ) {
    const immediatePreceding = smartContext?.immediateContext || [];
    const isMovieDiscussion = immediatePreceding.some(
      (d) =>
        d.text.toLowerCase().includes('movie') || d.text.toLowerCase().includes('film')
    );
    if (isMovieDiscussion && lowerReply.includes('exam')) {
      issues.push({
        type: 'context_mismatch',
        reason: 'Reply mentions exam when asked "Kaunsi?" about a movie discussion',
      });
    }
  }

  // L. HALLUCINATION CHECK (Unsupported specific fabrications)
  // Example: Incoming: "Kal aaoge?" -> Reply: "Haan, main 7 baje Patna se nikalunga"
  const isSimpleArrivalQuery =
    /(kal\s*aaoge|aaoge\s*kal|will\s*you\s*come|aana\s*hai|aa\s*rahe\s*ho)/i.test(
      lowerIncoming
    );
  if (isSimpleArrivalQuery) {
    const mentionedCities = [
      'patna',
      'mumbai',
      'bangalore',
      'kolkata',
      'chennai',
      'hyderabad',
      'lucknow',
      'pune',
    ];
    const foundCity = mentionedCities.find((c) => lowerReply.includes(c));
    if (foundCity) {
      const isCityInContext =
        (memoryDirective && memoryDirective.toLowerCase().includes(foundCity)) ||
        (recentDialogue && recentDialogue.some((d) => d.text.toLowerCase().includes(foundCity))) ||
        lowerIncoming.includes(foundCity);
      if (!isCityInContext) {
        issues.push({
          type: 'hallucination',
          reason: `Invented unsupported city ("${foundCity}") in reply to a simple arrival question`,
        });
      }
    }
  }

  // M. UNNATURAL RESPONSE (Numbered lists, essay transitions)
  if (/^\s*\d+\.\s+/m.test(text)) {
    issues.push({
      type: 'unnatural_response',
      reason: 'Numbered list formatting in chat message',
    });
  }
  if (
    /(iska\s*(mukhya\s*)?kaaran\s*yeh\s*hai|in\s*conclusion|furthermore|additionally)/i.test(
      lowerReply
    )
  ) {
    issues.push({
      type: 'unnatural_response',
      reason: 'Formal essay transition in casual chat message',
    });
  }

  // N. MEMORY OVERRIDE / CANCELLATION VIOLATION
  if (memoryDirective && memoryDirective.includes('RECENT OVERRIDE: PLAN CANCELLED')) {
    if (
      lowerReply.includes('delhi') &&
      !/(cancel|drop|nahi|nhi)/i.test(lowerReply)
    ) {
      issues.push({
        type: 'memory_misuse',
        reason: 'Asserted cancelled Delhi trip as active despite recent cancellation override',
      });
    }
  }

  const isValid = issues.length === 0;
  const primaryIssue = issues[0]?.type;
  const reason = issues[0]?.reason;

  return {
    isValid,
    primaryIssue,
    reason,
    issues,
    sanitizedReply: text,
    qualityScore: isValid ? 100 : Math.max(0, 100 - issues.length * 30),
  };
}

/**
 * Cleans, sanitizes, and filters model outputs.
 * Compatible drop-in replacement that uses Phase 5 sanitize and validate engines.
 */
export function cleanAndSanitizeReply(
  rawText: string,
  incomingText: string,
  style: AutoReplyStyle,
  partnerName: string,
  currentFullName: string,
  currentUsername: string,
  personality?: PerChatPersonality,
  recentAiReplies?: string[],
  smartContext?: SmartContextSelection,
  recentDialogue?: Array<{ senderName: string; text: string; isCurrentUser: boolean }>
): string {
  const resolvedPersonality = personality || resolvePerChatPersonality(style);
  const sanitized = sanitizeReplyText(
    rawText,
    partnerName,
    currentFullName,
    currentUsername,
    resolvedPersonality
  );

  const validation = validateReplyQuality({
    replyText: sanitized,
    incomingText,
    partnerName,
    currentFullName,
    currentUsername,
    personality: resolvedPersonality,
    style,
    recentDialogue: recentDialogue || [],
    smartContext,
    memoryDirective: smartContext?.prunedMemoryDirective,
  });

  if (validation.isValid) {
    return sanitized;
  }

  console.warn(
    `[AutoReplyEngine] Quality validation rejected draft (${validation.primaryIssue}: ${validation.reason}), using smart fallback:`,
    rawText
  );

  return generateSmartFallbackReply(
    incomingText,
    style,
    partnerName,
    resolvedPersonality,
    recentAiReplies
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolves a complete, isolated PerChatPersonality for a specific chat.
 * Strictly guarantees that if relationship is not explicitly provided, it defaults to 'unknown'.
 */
export function resolvePerChatPersonality(
  style: AutoReplyStyle,
  custom?: Partial<PerChatPersonality>
): PerChatPersonality {
  const styleDefaults: Record<AutoReplyStyle, PerChatPersonality> = {
    friend: {
      relationship: 'unknown',
      language: 'auto',
      dialect: 'standard',
      tone: 'friendly',
      formality: 'low',
      brevity: 'short',
      emojiFrequency: 'low',
      communicationStyle: 'simple',
    },
    casual: {
      relationship: 'unknown',
      language: 'auto',
      dialect: 'standard',
      tone: 'casual',
      formality: 'low',
      brevity: 'short',
      emojiFrequency: 'low',
      communicationStyle: 'direct',
    },
    supportive: {
      relationship: 'unknown',
      language: 'auto',
      dialect: 'standard',
      tone: 'supportive',
      formality: 'medium',
      brevity: 'normal',
      emojiFrequency: 'low',
      communicationStyle: 'supportive',
    },
    professional: {
      relationship: 'unknown',
      language: 'auto',
      dialect: 'standard',
      tone: 'professional',
      formality: 'high',
      brevity: 'short',
      emojiFrequency: 'off',
      communicationStyle: 'direct',
    },
  };

  const base = styleDefaults[style] || styleDefaults.friend;

  if (!custom) {
    return { ...base };
  }

  return {
    relationship: custom.relationship || base.relationship, // Never assume a relationship without explicit evidence!
    language: custom.language || base.language,
    dialect: custom.dialect || base.dialect,
    tone: custom.tone || base.tone,
    formality: custom.formality || base.formality,
    brevity: custom.brevity || base.brevity,
    emojiFrequency: custom.emojiFrequency || base.emojiFrequency,
    communicationStyle: custom.communicationStyle || base.communicationStyle,
  };
}


/**
 * Natural, human-like contextual fallback engine.
 * Never uses technical phrases, connection excuses, or robotic templates.
 * Strictly matches dialect (Hindi, Bhojpuri, Hinglish, English) and length.
 * Incorporates per-chat personality profile when available.
 */
export function generateSmartFallbackReply(
  partnerText: string,
  style: AutoReplyStyle,
  _partnerName: string,
  personality?: PerChatPersonality,
  recentAiReplies?: string[]
): string {
  const text = (partnerText || '').trim();
  const lower = text.toLowerCase();

  const pick = (arr: string[]) => {
    if (recentAiReplies && recentAiReplies.length > 0) {
      const recentNorm = recentAiReplies.map((r) =>
        r.toLowerCase().replace(/[.,!?'"~`]/g, '').trim()
      );
      const filtered = arr.filter(
        (item) => !recentNorm.includes(item.toLowerCase().replace(/[.,!?'"~`]/g, '').trim())
      );
      if (filtered.length > 0) {
        return filtered[Math.floor(Math.random() * filtered.length)];
      }
    }
    return arr[Math.floor(Math.random() * arr.length)];
  };

  const isBhojpuriExplicit = personality?.language === 'bhojpuri';
  const isEnglishExplicit = personality?.language === 'english';
  const isHindiExplicit = personality?.language === 'hindi';
  const isHighFormality =
    personality?.formality === 'high' ||
    personality?.tone === 'respectful' ||
    style === 'professional';

  // 1. Detect Script / Dialect
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const isBhojpuriDetected =
    text.includes('बाड़') ||
    text.includes('बानी') ||
    text.includes('करताड़') ||
    text.includes('का हाल बा') ||
    text.includes('कहाँ बा') ||
    text.includes('का भईल') ||
    lower.includes('baada') ||
    lower.includes('baani') ||
    lower.includes('ka haal ba') ||
    lower.includes('ka karat');

  let result = '';

  // 2. Bhojpuri Dialect Responses
  if (isBhojpuriExplicit || (personality?.language === 'auto' && isBhojpuriDetected)) {
    if (text.includes('कहाँ') || lower.includes('kahan') || lower.includes('kaha')) {
      result = pick(['घरे बानी', 'बस घरे बानी', 'यहीं बानी, बोला']);
    } else if (text.includes('का हाल') || lower.includes('haal')) {
      result = pick(['सब बढ़िया बा', 'सब बढ़िया बा, आपन बतावा', 'एकदम मस्त बा']);
    } else if (text.includes('का करता') || lower.includes('karat')) {
      result = pick(['बस बइठल बानी', 'कुछु ना, बस बइठल बानी', 'काम करत बानी']);
    } else {
      result = pick(['हाँ बोला', 'सब ठीक बा', 'हाँ, का बात बा?']);
    }
  } else if (
    isEnglishExplicit ||
    (personality?.language === 'auto' &&
      !hasDevanagari &&
      /^[a-z0-9\s.,!?'"()_-]+$/i.test(text) &&
      !['kaha', 'kahan', 'kidhar', 'kya', 'bhai', 'yaar', 'bata', 'aur', 'theek', 'hai'].some((w) =>
        lower.includes(w)
      ))
  ) {
    // 3. English Responses
    if (isHighFormality) {
      if (lower.includes('where')) result = 'Currently at my desk, please let me know.';
      else if (lower.includes('hi') || lower.includes('hello')) result = 'Hello, hope you are doing well.';
      else result = 'Noted, I will review and follow up shortly.';
    } else {
      if (lower === 'hi' || lower === 'hello' || lower === 'hey' || lower === 'hii' || lower === 'yo') {
        result = pick(['Hey! What’s up?', 'Hey, how’s it going?', 'Hey, all good?']);
      } else if (lower.includes('where')) {
        result = pick(['At home, what’s up?', 'I’m at home', 'Around here, tell me']);
      } else if (lower.includes('doing') || lower.includes('wyd') || lower.includes('sup') || lower.includes("what's up")) {
        result = pick(['Not much, just chilling. You?', 'Nothing much, you?', 'Just wrapped up. What’s up?']);
      } else if (lower.includes('how are you') || lower.includes('how r u')) {
        result = pick(['Doing good, you?', 'All good here! How about you?']);
      } else if (lower.includes('free')) {
        result = pick(['Yeah, tell me', 'Yeah, what’s up?']);
      } else {
        result = pick(['Yeah, tell me', 'All good, what about you?', 'Not much, tell me']);
      }
    }
  } else if (isHindiExplicit || hasDevanagari) {
    // 4. Pure Hindi / Devanagari Script Responses
    if (isHighFormality) {
      if (text.includes('कहाँ') || lower.includes('kaha')) result = 'कार्यालय में हूँ। बताइए?';
      else if (text.includes('नमस्ते') || text.includes('प्रणाम') || text.includes('हेलो') || text.includes('hi')) {
        result = 'नमस्ते! कहिए, कैसे मदद कर सकता हूँ?';
      } else {
        result = 'जी, मैंने देख लिया। कुछ समय में उत्तर देता हूँ।';
      }
    } else {
      if (text.includes('नमस्ते') || text.includes('हेलो') || text.includes('हाय') || text === 'हाँ') {
        result = pick(['हाँ बोलो', 'हे, कैसे हो?', 'हाँ जी, बताइए']);
      } else if (text.includes('कहाँ') || text.includes('किधर')) {
        result = pick(['घर पर हूँ', 'बस घर पे हूँ', 'यहीं हूँ, बोलो', 'घर पर ही हूँ']);
      } else if (text.includes('क्या कर') || text.includes('क्या हो')) {
        result = pick(['बस बैठा हूँ', 'कुछ नहीं, बस बैठा हूँ', 'बस फ्री हूँ अभी, तुम बताओ']);
      } else if (text.includes('और बताओ') || text.includes('और?') || text.includes('क्या हाल')) {
        result = pick(['सब बढ़िया, तुम बताओ', 'बस सब ठीक है, तुम सुनाओ', 'सब मस्त']);
      } else if (text.includes('फ्री')) {
        result = pick(['हाँ, बोलो', 'हाँ फ्री हूँ, बताओ']);
      } else {
        result = pick(['हाँ बोलो', 'अच्छा? क्या हुआ?', 'सब ठीक, तुम बताओ', 'बताओ ना']);
      }
    }
  } else {
    // 5. Hinglish (Casual, Everyday Texting - Default)
    if (isHighFormality) {
      if (lower.includes('kaha') || lower.includes('kahan')) {
        result = 'Office me hu. Bataiye kya kaam tha?';
      } else if (lower.includes('hi') || lower.includes('hello')) {
        result = 'Hello, hope all is well. Bataiye?';
      } else {
        result = 'Noted. Main thoda dekh kar update karta hu.';
      }
    } else {
      if (
        lower === 'hi' ||
        lower === 'hello' ||
        lower === 'hey' ||
        lower === 'hii' ||
        lower === 'suno' ||
        lower === 'sun' ||
        lower === 'bhai' ||
        lower === 'bro'
      ) {
        result = pick(['Haan bol 😄', 'Haan bol', 'Hey, kya haal?', 'Haan bolo', 'Bol na']);
      } else if (lower.includes('kaha') || lower.includes('kahan') || lower.includes('kidhar')) {
        result = pick(['Ghar pe hu', 'Bas ghar pe', 'Yahin hu, bol', 'Ghar pe hi hu']);
      } else if (lower.includes('kya kar') || lower.includes('kya chal') || lower.includes('wyd') || lower.includes('scene')) {
        result = pick(['Bas baitha hu', 'Kuch khaas nahi, tu bata', 'Bas baitha hu, tu bol', 'Kuch nahi yaar, tu bata']);
      } else if (lower.includes('aur batao') || lower.includes('aur bata') || lower === 'aur' || lower === 'aur?' || lower.includes('kya haal')) {
        result = pick(['Bas badhiya, tu bata', 'Sab sahi hai, tu bol', 'Bas chal raha hai, tu bata', 'Sab mast, tu bata']);
      } else if (lower.includes('free hai') || lower.includes('free ho') || lower.includes('busy')) {
        result = pick(['Haan, bol', 'Haan free hu, bata', 'Haan bol na']);
      } else if (lower === 'hmm' || lower === 'hm') {
        result = pick(['Kya soch raha?', 'Aur bata', 'Haan']);
      } else if (lower === 'haan' || lower === 'han' || lower === 'ha') {
        result = pick(['Aur bata', 'Sahi hai', 'Haan']);
      } else if (lower === 'acha' || lower === 'achha' || lower === 'ok' || lower === 'theek') {
        result = pick(['Haan', 'Aur bata kya scene hai?', 'Sahi hai']);
      } else {
        result = pick(['Haan bol', 'Bas yahi hu, bol', 'Achha? Kya hua?', 'Bata na', 'Nahi pata yaar', 'Yaad nahi abhi']);
      }
    }
  }

  // Strip emojis if personality has emojiFrequency === 'off'
  if (personality?.emojiFrequency === 'off') {
    result = result.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '').trim();
  }

  return result;
}

/**
 * Reads or updates the chat's Auto-Reply settings in Firestore and localStorage
 */
export async function saveChatAutoReplySettings(
  chatId: string,
  username: string,
  enabled: boolean,
  style: AutoReplyStyle,
  personality?: Partial<PerChatPersonality>
): Promise<void> {
  const cleanUsername = username.trim().toLowerCase();
  const resolvedPersonality = resolvePerChatPersonality(style, personality);

  // Save in local storage isolated by chatId and cleanUsername
  try {
    const key = `pinchat_autoreply_${chatId}_${cleanUsername}`;
    localStorage.setItem(
      key,
      JSON.stringify({ enabled, style, personality: resolvedPersonality })
    );
  } catch {
    // ignore
  }

  // Save in Firestore under chats/{chatId}
  if (db) {
    try {
      const chatRef = doc(db, 'chats', chatId);
      await setDoc(
        chatRef,
        {
          chatId,
          autoReplySettings: {
            [cleanUsername]: {
              enabled,
              style,
              personality: resolvedPersonality,
            },
          },
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[AutoReplyEngine] Firestore settings save note:', err);
    }
  }
}

/**
 * Updates only the Per-Chat Personality for a specific chat
 */
export async function saveChatAutoReplyPersonality(
  chatId: string,
  username: string,
  personality: Partial<PerChatPersonality>
): Promise<void> {
  const current = getChatAutoReplySettings(chatId, username);
  const updatedPersonality = resolvePerChatPersonality(current.style, {
    ...current.personality,
    ...personality,
  });
  await saveChatAutoReplySettings(
    chatId,
    username,
    current.enabled,
    current.style,
    updatedPersonality
  );
}

/**
 * Retrieves chat auto-reply settings (defaults to enabled: true, style: 'friend', relationship: 'unknown')
 */
export function getChatAutoReplySettings(
  chatId: string,
  username: string
): { enabled: boolean; style: AutoReplyStyle; personality: PerChatPersonality } {
  const cleanUsername = username.trim().toLowerCase();
  try {
    const key = `pinchat_autoreply_${chatId}_${cleanUsername}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      const style: AutoReplyStyle = parsed.style || 'friend';
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
        style,
        personality: resolvePerChatPersonality(style, parsed.personality),
      };
    }
  } catch {
    // ignore
  }

  // Default: Auto-Reply ON (true), style 'friend', and default friend personality with relationship 'unknown'
  return {
    enabled: true,
    style: 'friend',
    personality: resolvePerChatPersonality('friend'),
  };
}

// ============================================================================
// PHASE 3 — PER-CHAT CONVERSATION MEMORY SYSTEM IMPLEMENTATION
// ============================================================================

/**
 * Strips sensitive secrets (passwords, PINs, OTPs, financial numbers, auth tokens)
 * from memory text to ensure strictly secure memory storage (Security Rule #19).
 */
export function sanitizeMemorySecrets(text: string): string {
  if (!text) return '';
  return text
    .replace(/\b\d{4,8}\b/g, (match, offset, str) => {
      const surrounding = str.slice(Math.max(0, offset - 15), Math.min(str.length, offset + match.length + 15)).toLowerCase();
      if (/otp|pin|code|pass|cvv|token|secret/.test(surrounding)) {
        return '[REDACTED_SECRET]';
      }
      return match;
    })
    .replace(/password\s*[:=]\s*\S+/gi, '[REDACTED_PASSWORD]')
    .replace(/otp\s*[:=]?\s*\d+/gi, '[REDACTED_OTP]')
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED_CARD]');
}

/**
 * Resolves a clean, isolated PerChatConversationMemory for a specific chat.
 * Automatically discards expired temporary facts and temporary context (Expiration Rule #14).
 * Enforces per-chat isolation: strictly reads and manages only memory for the specified chatId.
 */
export function resolvePerChatMemory(
  chatId: string,
  remoteMemory?: PerChatConversationMemory,
  memorySummary?: string
): PerChatConversationMemory {
  let memory: PerChatConversationMemory | null = null;
  const localKey = `pinchat_memory_${chatId}`;

  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      memory = JSON.parse(raw);
    }
  } catch {
    // ignore
  }

  if (!memory && remoteMemory) {
    memory = remoteMemory;
  }

  if (!memory) {
    memory = {
      chatId,
      updatedAt: Date.now(),
      conversationSummary: memorySummary || '',
      importantFacts: [],
    };
  } else {
    // If remote has newer updatedAt, merge with remote's facts
    if (remoteMemory && (remoteMemory.updatedAt || 0) > (memory.updatedAt || 0)) {
      memory = remoteMemory;
    }
    if (memorySummary && !memory.conversationSummary) {
      memory.conversationSummary = memorySummary;
    }
  }

  // Enforce correct chatId isolation
  memory.chatId = chatId;

  // Clean expired temporary facts and temporary context
  const now = Date.now();
  if (memory.importantFacts && Array.isArray(memory.importantFacts)) {
    memory.importantFacts = memory.importantFacts.filter((f) => {
      if (f.cancelled) return false;
      if (f.isTemporary && f.expiresAt && f.expiresAt <= now) return false;
      return true;
    });
  } else {
    memory.importantFacts = [];
  }

  if (memory.temporaryContextExpiresAt && memory.temporaryContextExpiresAt <= now) {
    memory.temporaryContext = undefined;
    memory.temporaryContextExpiresAt = undefined;
  }

  return memory;
}

/**
 * Formats Per-Chat Memory into a structured, high-priority, speaker-attributed
 * context block for the Gemini 1.5 Flash model.
 */
export function formatMemoryForContext(
  memory: PerChatConversationMemory,
  partnerName: string,
  currentFullName: string
): string {
  const sections: string[] = [];
  const now = Date.now();

  // 1. Immediate Ongoing Topic / Recent Context
  if (memory.recentContext && memory.recentContext.trim()) {
    sections.push(`- Immediate Ongoing Topic: ${sanitizeMemorySecrets(memory.recentContext.trim())}`);
  }

  // 2. Active Temporary Context (time-sensitive, if not expired)
  if (
    memory.temporaryContext &&
    memory.temporaryContext.trim() &&
    (!memory.temporaryContextExpiresAt || memory.temporaryContextExpiresAt > now)
  ) {
    sections.push(`- Active Temporary Context (time-sensitive): ${sanitizeMemorySecrets(memory.temporaryContext.trim())}`);
  }

  // 3. Important Facts (Strictly speaker-attributed!)
  const activeFacts = (memory.importantFacts || []).filter(
    (f) => !f.cancelled && (!f.isTemporary || !f.expiresAt || f.expiresAt > now)
  );

  if (activeFacts.length > 0) {
    const factLines: string[] = [];
    for (const f of activeFacts) {
      let speakerLabel = partnerName;
      if (f.speaker === 'currentUser') {
        speakerLabel = currentFullName;
      } else if (f.speaker === 'third_party') {
        speakerLabel = f.speakerName || 'Third Party';
      }
      factLines.push(`  * [${speakerLabel}]: ${sanitizeMemorySecrets(f.fact)}`);
    }
    sections.push(`- Verified Facts (Strict Speaker Attribution):\n${factLines.join('\n')}`);
  }

  // 4. Communication Preferences
  if (memory.communicationStyle && memory.communicationStyle.trim()) {
    sections.push(`- Stated/Observed Communication Preference: ${memory.communicationStyle.trim()}`);
  }

  // 5. Established Relationship Context
  if (memory.relationshipContext && memory.relationshipContext.trim()) {
    sections.push(`- Established Relationship: ${memory.relationshipContext.trim()}`);
  }

  // 6. Rolling Conversation Summary
  if (memory.conversationSummary && memory.conversationSummary.trim()) {
    sections.push(`- Rolling Conversation Summary: ${sanitizeMemorySecrets(memory.conversationSummary.trim())}`);
  }

  return sections.join('\n\n');
}

/**
 * Persists updated Per-Chat Conversation Memory to local storage and Firestore.
 * Strictly scoped to the given chatId.
 */
export async function savePerChatMemory(
  chatId: string,
  memory: PerChatConversationMemory
): Promise<void> {
  const localKey = `pinchat_memory_${chatId}`;
  try {
    localStorage.setItem(localKey, JSON.stringify(memory));
  } catch {
    // ignore
  }

  if (db) {
    try {
      const chatDocRef = doc(db, 'chats', chatId);
      const summaryToSave =
        memory.conversationSummary ||
        (memory.importantFacts?.slice(-3).map((f) => f.fact).join('; ') || '');

      await updateDoc(chatDocRef, {
        conversationMemory: memory,
        memorySummary: summaryToSave,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.warn('[AutoReplyEngine] Firestore memory update note:', err);
    }
  }
}

/**
 * Fast heuristic check to determine if a message exchange contains memory-worthy topics
 * (e.g. plans, exams, schedules, travel, health, cancellations, preferences).
 * Avoids executing expensive operations on pure greetings like "hi", "ok", "haan".
 */
export function isMemoryWorthy(partnerText: string, replyText: string): boolean {
  const combined = `${partnerText} ${replyText}`.toLowerCase();

  const keywords = [
    'exam', 'test', 'paper', 'viva', 'result', 'score', 'marks', 'study', 'padhai',
    'college', 'school', 'coaching', 'admission', 'assignment', 'homework', 'project',
    'physics', 'maths', 'chemistry', 'biology', 'science', 'history', 'english', 'hindi',
    'office', 'job', 'interview', 'salary', 'meeting', 'client', 'shift', 'work', 'boss',
    'travel', 'trip', 'flight', 'train', 'bus', 'ticket', 'delhi', 'mumbai', 'bangalore',
    'kolkata', 'patna', 'pune', 'hyderabad', 'goa', 'village', 'gaon', 'ghumna', 'jaunga',
    'market', 'bazaar', 'shopping', 'mall', 'doctor', 'hospital', 'medicine', 'dava',
    'fever', 'tabiyat', 'bimar', 'headache', 'pain', 'rest', 'aaram', 'mummy', 'papa',
    'bhai', 'behen', 'brother', 'sister', 'mom', 'dad', 'family', 'birthday', 'shadi',
    'wedding', 'party', 'cricket', 'match', 'football',
    'cancel', 'cancelled', 'postponed', 'drop', 'badal', 'change', 'nahi ja raha',
    'nahi aaunga', 'nahi jaunga', 'plan cancel', 'kal', 'parso', 'aaj', 'tomorrow',
    'tonight', 'yesterday', 'weekend', 'sunday', 'monday', 'pasand', 'like', 'hate',
    'love', 'prefer'
  ];

  for (const kw of keywords) {
    if (combined.includes(kw)) {
      return true;
    }
  }

  // If incoming message has 8+ words, it likely carries personal context
  const words = (partnerText || '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 8) {
    return true;
  }

  return false;
}

/**
 * Deterministic local heuristic extractor for offline or fallback operation.
 * Handles speaker attribution, cancellations, exams, temporary tasks, and travel.
 */
export function extractMemoryHeuristically(
  partnerText: string,
  replyText: string,
  partnerName: string,
  currentFullName: string,
  existingMemory: PerChatConversationMemory
): {
  newFacts: MemoryFactItem[];
  cancelledTopics: string[];
  recentTopic?: string;
  temporaryActivity?: string;
  temporaryHours?: number;
  summaryUpdate?: string;
} {
  const lowerPartner = partnerText.toLowerCase();
  const lowerReply = replyText.toLowerCase();
  const newFacts: MemoryFactItem[] = [];
  const cancelledTopics: string[] = [];
  let recentTopic: string | undefined = undefined;
  let temporaryActivity: string | undefined = undefined;
  let temporaryHours: number | undefined = undefined;
  const now = Date.now();

  // 1. Check for Cancellations & Corrections (Test 3)
  const isCancellation =
    /cancel|nahi\s*ja\s*raha|nahi\s*jaunga|drop\s*kar\s*diya|plan\s*change|postpone/i.test(lowerPartner) ||
    /cancel|plan\s*cancel/i.test(lowerReply);

  if (isCancellation) {
    if (/delhi|mumbai|trip|travel|ghumna/i.test(lowerPartner + ' ' + lowerReply)) {
      cancelledTopics.push('travel', 'delhi', 'trip');
      recentTopic = 'Cancelled travel plan';
    }
    if (/exam/i.test(lowerPartner + ' ' + lowerReply)) {
      cancelledTopics.push('exam');
      recentTopic = 'Exam update / cancellation';
    }
  }

  // 2. Check for Speaker Attribution: Third-Party vs Partner (Test 4)
  const isThirdPartyMention =
    /(mere|apne)?\s*(bhai|brother|sister|behen|mummy|papa|mom|dad|dost|friend)\s*(ka|ki|ke|has|is)/i.test(lowerPartner);

  if (isThirdPartyMention) {
    let thirdPartyRelation = 'relative';
    if (/bhai|brother/i.test(lowerPartner)) thirdPartyRelation = 'brother';
    else if (/behen|sister/i.test(lowerPartner)) thirdPartyRelation = 'sister';
    else if (/mummy|mom/i.test(lowerPartner)) thirdPartyRelation = 'mother';
    else if (/papa|dad/i.test(lowerPartner)) thirdPartyRelation = 'father';
    else if (/dost|friend/i.test(lowerPartner)) thirdPartyRelation = 'friend';

    if (/exam|test|paper/i.test(lowerPartner)) {
      newFacts.push({
        id: `fact-${now}-${Math.random().toString(36).slice(2, 6)}`,
        speaker: 'third_party',
        speakerName: `${partnerName}'s ${thirdPartyRelation}`,
        topic: 'exam',
        fact: `${partnerName}'s ${thirdPartyRelation} has an exam`,
        timestamp: now,
        confidence: 'high',
        isTemporary: true,
        expiresAt: now + 72 * 3600 * 1000,
      });
      recentTopic = `${partnerName}'s ${thirdPartyRelation}'s exam`;
    }
  } else if (!isCancellation) {
    // 3. Partner's own Exam (Test 1)
    if (/exam|test|paper|viva/i.test(lowerPartner)) {
      let subject = '';
      if (/physics/i.test(lowerPartner)) subject = 'Physics';
      else if (/maths|math/i.test(lowerPartner)) subject = 'Maths';
      else if (/chemistry/i.test(lowerPartner)) subject = 'Chemistry';
      else if (/biology/i.test(lowerPartner)) subject = 'Biology';

      const when = /kal|tomorrow/i.test(lowerPartner) ? 'tomorrow' : 'upcoming';
      newFacts.push({
        id: `fact-${now}-${Math.random().toString(36).slice(2, 6)}`,
        speaker: 'partner',
        speakerName: partnerName,
        topic: 'exam',
        fact: `Has a ${subject ? subject + ' ' : ''}exam ${when}`,
        timestamp: now,
        confidence: 'high',
        isTemporary: true,
        expiresAt: now + 48 * 3600 * 1000,
      });
      recentTopic = `${subject || 'Upcoming'} exam preparation`;
    }

    // 4. Partner's Travel Plan (Test 3)
    if (/delhi|mumbai|bangalore|kolkata|patna|goa/i.test(lowerPartner) && /jaunga|ja\s*raha|going/i.test(lowerPartner)) {
      let destination = 'out of town';
      if (/delhi/i.test(lowerPartner)) destination = 'Delhi';
      else if (/mumbai/i.test(lowerPartner)) destination = 'Mumbai';
      else if (/goa/i.test(lowerPartner)) destination = 'Goa';
      else if (/patna/i.test(lowerPartner)) destination = 'Patna';

      const when = /kal|tomorrow/i.test(lowerPartner) ? 'tomorrow' : 'soon';
      newFacts.push({
        id: `fact-${now}-${Math.random().toString(36).slice(2, 6)}`,
        speaker: 'partner',
        speakerName: partnerName,
        topic: 'travel',
        fact: `Planning to travel to ${destination} ${when}`,
        timestamp: now,
        confidence: 'high',
        isTemporary: true,
        expiresAt: now + 72 * 3600 * 1000,
      });
      recentTopic = `Travel to ${destination}`;
    }

    // 5. Temporary Activities (Test 2: e.g. "Aaj market ja raha hu")
    if (/market|bazaar|mall|shopping|traffic|gym/i.test(lowerPartner) && /ja\s*raha|hu/i.test(lowerPartner)) {
      let activity = 'Running errands';
      if (/market|bazaar/i.test(lowerPartner)) activity = 'Going to the market';
      else if (/mall|shopping/i.test(lowerPartner)) activity = 'Shopping';
      else if (/traffic/i.test(lowerPartner)) activity = 'Stuck in traffic';
      else if (/gym/i.test(lowerPartner)) activity = 'At the gym';

      temporaryActivity = activity;
      temporaryHours = 6;
      recentTopic = activity;
    }
  }

  return {
    newFacts,
    cancelledTopics,
    recentTopic,
    temporaryActivity,
    temporaryHours,
  };
}

/**
 * Parameters for the asynchronous background memory update
 */
export interface BackgroundMemoryUpdateParams {
  chatId: string;
  currentUsername: string;
  currentFullName: string;
  partnerUsername: string;
  partnerName: string;
  partnerText: string;
  replyText: string;
  existingMemory: PerChatConversationMemory;
  recentDialogue: Array<{ senderName: string; text: string; isCurrentUser: boolean }>;
}

/**
 * Non-blocking, asynchronous Per-Chat Conversation Memory consolidator.
 * Extracts durable facts, updates ongoing topic, handles cancellations and temporary contexts.
 * Uses Gemini 1.5 Flash if available, with robust heuristic fallback.
 */
export async function triggerBackgroundMemoryUpdate(
  params: BackgroundMemoryUpdateParams
): Promise<void> {
  const {
    chatId,
    currentUsername,
    currentFullName,
    partnerUsername,
    partnerName,
    partnerText,
    replyText,
    existingMemory,
    recentDialogue,
  } = params;

  // 1. Fast check: is this turn memory-worthy?
  if (!isMemoryWorthy(partnerText, replyText)) {
    return;
  }

  const apiKey =
    (import.meta.env.VITE_GEMINI_API_KEY as string) ||
    (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '') ||
    '';

  let extractedNewFacts: MemoryFactItem[] = [];
  let cancelledTopics: string[] = [];
  let recentTopic: string | undefined = undefined;
  let temporaryActivity: string | undefined = undefined;
  let temporaryHours: number | undefined = undefined;
  let summaryUpdate: string | undefined = undefined;

  // 2. Attempt Gemini 1.5 Flash Memory Extraction if API key is active
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const transcriptSlice = recentDialogue.slice(-6).map((d) => `${d.senderName}: ${d.text}`).join('\n');
      const latestTurn = `${partnerName}: "${partnerText}"\n${currentFullName}: "${replyText}"`;

      const prompt = `You are an internal memory extraction worker for a private chat between ${currentFullName} (@${currentUsername}) and ${partnerName} (@${partnerUsername}).
Recent chat:
${transcriptSlice}

Latest turn:
${latestTurn}

Current Active Memory Facts:
${JSON.stringify(existingMemory.importantFacts || [])}

TASK: Extract genuinely useful, durable facts, ongoing topic, or plan cancellations.
STRICT RULES:
1. Retain only genuinely useful facts (e.g. upcoming exam/event, travel plan, family detail, stable preference).
2. DO NOT store trivial chit-chat ("hi", "eating food", "ok").
3. SPEAKER ATTRIBUTION:
   - "partner": Fact belongs to ${partnerName}
   - "currentUser": Fact belongs to ${currentFullName}
   - "third_party": Fact belongs to someone else (e.g. ${partnerName}'s brother has an exam -> speaker: "third_party", speakerName: "${partnerName}'s brother")
4. TEMPORARY VS STABLE:
   - Going to market / stuck in traffic -> isTemporary: true, expiresHours: 4 to 8.
   - Exam tomorrow / job interview next week -> isTemporary: true, expiresHours: 48 to 72.
   - City / food preference / hobby -> isTemporary: false.
5. CORRECTIONS & CANCELLATIONS: If someone said a plan is cancelled or changed (e.g. "plan cancel ho gaya"), identify this as a cancelled topic so previous plans are deactivated!
6. ZERO SECRETS: Never extract passwords, OTPs, PINs, card numbers, or secret credentials.
7. Return strictly valid JSON (no markdown fences, no extra text):
{
  "recentTopic": "short topic string or empty",
  "newFacts": [
    {
      "speaker": "partner" | "currentUser" | "third_party",
      "speakerName": "optional name",
      "topic": "topic slug",
      "fact": "concise factual statement",
      "isTemporary": boolean,
      "expiresHours": number,
      "confidence": "high" | "medium"
    }
  ],
  "cancelledTopics": ["topic name to cancel"],
  "temporaryActivity": "short description of active temporary task or empty",
  "temporaryHours": number,
  "summaryUpdate": "1-2 sentence rolling summary of chat relationship"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.1,
          maxOutputTokens: 300,
        },
      });

      const rawJson = (response.text || '').replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      if (rawJson) {
        const parsed = JSON.parse(rawJson);
        if (parsed.recentTopic) recentTopic = sanitizeMemorySecrets(parsed.recentTopic);
        if (parsed.temporaryActivity) temporaryActivity = sanitizeMemorySecrets(parsed.temporaryActivity);
        if (typeof parsed.temporaryHours === 'number') temporaryHours = parsed.temporaryHours;
        if (parsed.summaryUpdate) summaryUpdate = sanitizeMemorySecrets(parsed.summaryUpdate);
        if (Array.isArray(parsed.cancelledTopics)) {
          cancelledTopics = parsed.cancelledTopics.map((t: string) => t.toLowerCase().trim());
        }
        if (Array.isArray(parsed.newFacts)) {
          const now = Date.now();
          for (const nf of parsed.newFacts) {
            if (nf && nf.fact) {
              const cleanFact = sanitizeMemorySecrets(nf.fact);
              if (cleanFact) {
                const expiresHours = typeof nf.expiresHours === 'number' ? nf.expiresHours : 48;
                extractedNewFacts.push({
                  id: `fact-${now}-${Math.random().toString(36).slice(2, 6)}`,
                  speaker: nf.speaker === 'currentUser' ? 'currentUser' : nf.speaker === 'third_party' ? 'third_party' : 'partner',
                  speakerName: nf.speakerName || (nf.speaker === 'currentUser' ? currentFullName : partnerName),
                  topic: (nf.topic || 'general').toLowerCase().trim(),
                  fact: cleanFact,
                  timestamp: now,
                  confidence: nf.confidence === 'medium' ? 'medium' : 'high',
                  isTemporary: Boolean(nf.isTemporary),
                  expiresAt: nf.isTemporary ? now + expiresHours * 3600 * 1000 : undefined,
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[AutoReplyEngine] LLM memory extraction note (using heuristic fallback):', err);
    }
  }

  // 3. If Gemini didn't return facts or was offline, run deterministic heuristic extraction
  if (extractedNewFacts.length === 0 && cancelledTopics.length === 0 && !temporaryActivity) {
    const heuristic = extractMemoryHeuristically(
      partnerText,
      replyText,
      partnerName,
      currentFullName,
      existingMemory
    );
    extractedNewFacts = heuristic.newFacts;
    cancelledTopics = heuristic.cancelledTopics;
    if (heuristic.recentTopic) recentTopic = heuristic.recentTopic;
    if (heuristic.temporaryActivity) temporaryActivity = heuristic.temporaryActivity;
    if (heuristic.temporaryHours) temporaryHours = heuristic.temporaryHours;
  }

  // 4. Merge Extracted Information into Existing Memory Object
  const updatedMemory: PerChatConversationMemory = {
    ...existingMemory,
    chatId,
    updatedAt: Date.now(),
    importantFacts: [...(existingMemory.importantFacts || [])],
  };

  // Handle Cancellations / Corrections: mark matching topics as cancelled or remove them (Test 3)
  if (cancelledTopics.length > 0) {
    updatedMemory.importantFacts = updatedMemory.importantFacts.map((f) => {
      const isMatch = cancelledTopics.some((ct) => f.topic.includes(ct) || ct.includes(f.topic));
      if (isMatch) {
        return { ...f, cancelled: true };
      }
      return f;
    }).filter((f) => !f.cancelled);
  }

  // Add new facts (prevent duplicates and cap maximum facts to 20 for speed and focus)
  for (const nf of extractedNewFacts) {
    // If existing fact on same topic exists, replace with updated newer fact
    const existingIdx = updatedMemory.importantFacts.findIndex(
      (f) => f.speaker === nf.speaker && f.topic === nf.topic
    );
    if (existingIdx >= 0) {
      updatedMemory.importantFacts[existingIdx] = nf;
    } else {
      updatedMemory.importantFacts.push(nf);
    }
  }

  // Cap facts to 20 most recent
  if (updatedMemory.importantFacts.length > 20) {
    updatedMemory.importantFacts = updatedMemory.importantFacts.slice(-20);
  }

  // Update Recent Topic Context
  if (recentTopic) {
    updatedMemory.recentContext = recentTopic;
  }

  // Update Temporary Context (with TTL, e.g. 6 hours)
  if (temporaryActivity) {
    const hours = temporaryHours || 6;
    updatedMemory.temporaryContext = temporaryActivity;
    updatedMemory.temporaryContextExpiresAt = Date.now() + hours * 3600 * 1000;
  }

  // Update Rolling Conversation Summary
  if (summaryUpdate) {
    updatedMemory.conversationSummary = summaryUpdate;
  } else if (!updatedMemory.conversationSummary && updatedMemory.importantFacts.length > 0) {
    updatedMemory.conversationSummary = updatedMemory.importantFacts
      .slice(-3)
      .map((f) => f.fact)
      .join('; ');
  }

  // 5. Persist to isolated local storage and Firestore
  await savePerChatMemory(chatId, updatedMemory);
}

// ============================================================================
// PHASE 4 — SMART CONTEXT MANAGEMENT & SELECTION SYSTEM IMPLEMENTATION
// ============================================================================

/**
 * Filter list of common linguistic stop words / filler particles across
 * Hinglish, Hindi, and English to isolate high-value topical semantic tokens.
 */
export const CONTEXT_STOP_WORDS = new Set([
  'hai', 'ho', 'hu', 'he', 'h', 'tha', 'thi', 'the', 'kya', 'kyu', 'kyun', 'kab', 'kaha',
  'kahan', 'kaise', 'aur', 'ya', 'par', 'per', 'se', 'me', 'mein', 'ko', 'ka', 'ki', 'ke',
  'ye', 'yeh', 'wo', 'woh', 'hum', 'mai', 'main', 'tu', 'tum', 'aap', 'toh', 'to', 'na',
  'nahi', 'naahi', 'bhi', 'ab', 'abhi', 'bas', 'yaar', 'bhai', 'bro', 'dude', 'sir',
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'and', 'but', 'or', 'so', 'at', 'by', 'for', 'in', 'into', 'of', 'off',
  'on', 'out', 'over', 'to', 'up', 'with', 'it', 'its', 'this', 'that', 'he', 'him', 'his',
  'she', 'her', 'they', 'them', 'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
  'ok', 'okay', 'haan', 'ha', 'hnn', 'acha', 'achha', 'hnm', 'hmm', 'lol', 'batao', 'bol',
  'karo', 'karna', 'gaya', 'gayi', 'gaye', 'raha', 'rahi', 'rahe', 'kuch', 'koi'
]);

/**
 * Extracts meaningful semantic keywords from a message text.
 */
export function extractContextKeywords(text: string): string[] {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !CONTEXT_STOP_WORDS.has(w));
  return Array.from(new Set(words));
}

/**
 * Detects whether the incoming message is a short query, pronoun-dependent reference,
 * or follow-up question requiring strong immediate context anchoring (Priority 2).
 */
export function detectShortFollowUpOrPronouns(text: string): {
  isShortFollowUp: boolean;
  hasPronouns: boolean;
  detectedPronouns: string[];
} {
  const trimmed = (text || '').trim().toLowerCase();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  // Short interrogation / continuation words:
  // e.g. "Kyu?", "Kab?", "Kahan?", "Kaise?", "Phir?", "Achha?", "Haan?", "Really?", "Why?", "When?", "How?", "Which?", "Kaunsi?", "Kitne baje?"
  const isShortPattern =
    /^(kyu|kyun|kab|kaha|kahan|kaise|phir|fir|achha|acha|haan|ha|really|why|when|where|how|which|kaunsi|kaun|kis|kisko|kitne\s*baje|kitna|batao|sachi|kya)\b/i.test(
      trimmed
    );
  const isShortFollowUp = isShortPattern || (wordCount <= 3 && trimmed.length <= 16);

  // Pronouns / demonstratives requiring prior context:
  // e.g. "wo", "woh", "usne", "uska", "uski", "uske", "unka", "unki", "unhe", "ye", "yeh", "isme", "usme", "he", "she", "it", "they"
  const pronounRegex = /\b(wo|woh|usne|uska|uski|uske|unka|unki|unke|unhe|unse|ye|yeh|isme|usme|isse|usse|it|this|that|he|him|his|she|her|they|them|their)\b/gi;
  const matches = trimmed.match(pronounRegex) || [];
  const hasPronouns = matches.length > 0;

  return {
    isShortFollowUp,
    hasPronouns,
    detectedPronouns: Array.from(new Set(matches.map((m) => m.toLowerCase()))),
  };
}

/**
 * Detects topic switching between recent conversation and older turns.
 * Returns true if recent conversation and incoming message represent a distinct new topic
 * and older messages should be ignored rather than contaminating the reply.
 */
export function detectTopicSwitch(
  immediateKeywords: string[],
  olderKeywords: string[],
  incomingText: string
): boolean {
  if (olderKeywords.length < 2 || immediateKeywords.length === 0) {
    return false;
  }

  // Explicit conversational topic shift markers (e.g., "waise", "by the way", "chod na", "chhoro", "dusri baat", "aur suno")
  const hasTopicShiftMarker = /\b(waise|by the way|btw|chod na|chhoro|dusri baat|aur suno|achha ek baat|chalo chhodo)\b/i.test(
    incomingText
  );

  // Compute keyword overlap
  const immediateSet = new Set(immediateKeywords);
  const overlap = olderKeywords.filter((k) => immediateSet.has(k));

  if (hasTopicShiftMarker) {
    return true;
  }

  // If there is zero overlap between older topic and immediate topic, and both have solid keywords
  if (overlap.length === 0 && olderKeywords.length >= 3 && immediateKeywords.length >= 2) {
    return true;
  }

  return false;
}

/**
 * Evaluates memory conflicts with recent conversation (Rule #19 & Test 7).
 * If recent conversation states that a plan or topic was cancelled or changed
 * (e.g. "Delhi plan cancel ho gaya"), the active memory fact is pruned/overridden,
 * guaranteeing that recent conversation ALWAYS beats older memory.
 */
export function pruneMemoryConflictsAndDuplicates(
  memory: PerChatConversationMemory,
  recentDialogue: Array<{ senderName: string; text: string; isCurrentUser: boolean }>,
  partnerName: string,
  currentFullName: string
): {
  prunedDirective: string;
  cancelledTopics: string[];
} {
  const cancelledTopics: string[] = [];
  const recentTexts = recentDialogue.slice(-8).map((d) => d.text.toLowerCase()).join(' ');

  // Detect cancellations or changes in recent dialogue
  const cancellationRegex = /\b(cancel|cancelled|nahi\s*ja\s*raha|nahi\s*jaunga|drop\s*kar\s*diya|plan\s*change|plan\s*cancel|postpone|nahi\s*hoga|chhod\s*diya|badal\s*gaya)\b/i;

  if (cancellationRegex.test(recentTexts)) {
    if (/delhi|mumbai|bangalore|goa|trip|travel|ghumna/i.test(recentTexts)) {
      cancelledTopics.push('travel', 'delhi', 'trip');
    }
    if (/exam|test|paper/i.test(recentTexts)) {
      cancelledTopics.push('exam', 'test');
    }
    if (/movie|film/i.test(recentTexts)) {
      cancelledTopics.push('movie', 'film');
    }
    if (/meeting|interview/i.test(recentTexts)) {
      cancelledTopics.push('meeting', 'interview');
    }
  }

  // Clone memory to avoid mutation
  const activeFacts = (memory.importantFacts || []).filter((f) => {
    if (f.cancelled) return false;
    // If fact topic or text matches cancelled topic, prune it
    const factText = (f.topic + ' ' + f.fact).toLowerCase();
    const isCancelled = cancelledTopics.some((ct) => factText.includes(ct));
    if (isCancelled) return false;

    // Deduplication check: if fact is already explicitly discussed in last 4 recent messages
    const recentTail = recentDialogue.slice(-4).map((d) => d.text.toLowerCase()).join(' ');
    const factKeywords = extractContextKeywords(f.fact);
    if (factKeywords.length >= 2) {
      const matchCount = factKeywords.filter((k) => recentTail.includes(k)).length;
      // If 80%+ of fact keywords are already present in immediate recent dialogue, omit duplicate from memory
      if (matchCount >= factKeywords.length - 1 && matchCount >= 2) {
        return false;
      }
    }

    return true;
  });

  const prunedMemoryObj: PerChatConversationMemory = {
    ...memory,
    importantFacts: activeFacts,
  };

  let formatted = formatMemoryForContext(prunedMemoryObj, partnerName, currentFullName);

  if (cancelledTopics.length > 0) {
    formatted = `${formatted}\n- RECENT OVERRIDE: Recent conversation explicitly indicated cancellation/change regarding: ${cancelledTopics.join(', ')}. Current conversation ALWAYS overrides past plans.`;
  }

  return {
    prunedDirective: formatted.trim(),
    cancelledTopics,
  };
}

/**
 * Smart Context Selection Engine (Phase 4).
 * Selects the most relevant conversation items across layers:
 * Current Message > Immediate Preceding Context > Recent Conversation > Relevant Older Messages.
 * Filters out irrelevant older chatter when topics switch, and manages context budget cleanly.
 */
export function selectSmartConversationContext(params: {
  recentDialogue: Array<{ senderName: string; text: string; isCurrentUser: boolean }>;
  bundledPartnerText: string;
  partnerName: string;
  currentFullName: string;
  perChatMemory: PerChatConversationMemory;
  formattedMemoryDirective: string;
}): SmartContextSelection {
  const {
    recentDialogue,
    bundledPartnerText,
    partnerName,
    currentFullName,
    perChatMemory,
  } = params;

  if (!recentDialogue || recentDialogue.length === 0) {
    return {
      selectedDialogue: [],
      immediateContext: [],
      isShortFollowUp: false,
      hasPronouns: false,
      isTopicSwitched: false,
      prunedMemoryDirective: params.formattedMemoryDirective || '',
    };
  }

  // 1. Analyze Current Incoming Message (Priority 1)
  const { isShortFollowUp, hasPronouns } = detectShortFollowUpOrPronouns(bundledPartnerText);
  const incomingKeywords = extractContextKeywords(bundledPartnerText);

  // 2. Identify Immediate Preceding Context Window (Priority 2)
  // Take 2 to 4 messages immediately preceding the incoming message
  const immediateWindowSize = isShortFollowUp || hasPronouns ? Math.min(4, recentDialogue.length) : Math.min(3, recentDialogue.length);
  const immediateStartIndex = Math.max(0, recentDialogue.length - immediateWindowSize);
  const immediateContext: SmartContextDialogueItem[] = recentDialogue.slice(immediateStartIndex).map((item) => ({
    ...item,
    isImmediate: true,
  }));

  const immediateKeywords = extractContextKeywords(
    immediateContext.map((c) => c.text).join(' ') + ' ' + bundledPartnerText
  );

  // 3. Process Older Messages (Messages before immediate window)
  const olderMessages = recentDialogue.slice(0, immediateStartIndex);
  const olderKeywords = extractContextKeywords(olderMessages.map((m) => m.text).join(' '));

  // 4. Topic Switching vs Continuity Detection
  const isTopicSwitched = detectTopicSwitch(immediateKeywords, olderKeywords, bundledPartnerText);

  // 5. Select Relevant Older Messages (Priority 4)
  const selectedOlderMessages: SmartContextDialogueItem[] = [];

  if (!isTopicSwitched && olderMessages.length > 0) {
    // Score each older message for relevance against incoming & immediate keywords
    const searchKeywords = new Set([...incomingKeywords, ...immediateKeywords]);

    if (searchKeywords.size > 0) {
      const scoredOlder: Array<{ item: SmartContextDialogueItem; score: number; index: number }> = [];

      olderMessages.forEach((msg, idx) => {
        const msgWords = extractContextKeywords(msg.text);
        let score = 0;
        for (const w of msgWords) {
          if (searchKeywords.has(w)) {
            score += 2;
          }
        }
        // Give recency bonus (closer to current time has higher base weight)
        const recencyBonus = (idx / olderMessages.length) * 0.8;
        score += recencyBonus;

        scoredOlder.push({
          item: { ...msg, isRelevantOlder: score >= 2, relevanceScore: score },
          score,
          index: idx,
        });
      });

      // Filter to relevant items with positive topic match
      const relevantMatches = scoredOlder.filter((s) => s.score >= 1.5);

      if (relevantMatches.length > 0) {
        // Take up to 4 most relevant older messages
        relevantMatches.sort((a, b) => b.score - a.score);
        const topMatches = relevantMatches.slice(0, 4).sort((a, b) => a.index - b.index);
        topMatches.forEach((m) => selectedOlderMessages.push(m.item));
      } else {
        // If no specific topic match, take up to 3 recent messages from older window if context budget allows
        const recentFallback = olderMessages.slice(-3).map((m) => ({ ...m }));
        selectedOlderMessages.push(...recentFallback);
      }
    } else {
      // Default: take recent 3 from older messages
      const recentFallback = olderMessages.slice(-3).map((m) => ({ ...m }));
      selectedOlderMessages.push(...recentFallback);
    }
  }

  // 6. Context Budget Assembly (Priority 1 + 2 + 3 + 4 in strict chronological order)
  // Budget limit: max 12 dialogue items
  const combined = [...selectedOlderMessages, ...immediateContext];

  combined.sort((a, b) => {
    const idxA = recentDialogue.findIndex((rd) => rd.senderName === a.senderName && rd.text === a.text);
    const idxB = recentDialogue.findIndex((rd) => rd.senderName === b.senderName && rd.text === b.text);
    return idxA - idxB;
  });

  // Remove potential duplicates while preserving order
  const selectedDialogue: SmartContextDialogueItem[] = [];
  const seenKeys = new Set<string>();
  for (const item of combined) {
    const key = `${item.senderName}:::${item.text}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      selectedDialogue.push(item);
    }
  }

  // Cap to context budget of 12 messages maximum
  const budgetedDialogue = selectedDialogue.length > 12 ? selectedDialogue.slice(-12) : selectedDialogue;

  // 7. Memory Conflict Resolution & Deduplication (Priority 5)
  const { prunedDirective } = pruneMemoryConflictsAndDuplicates(
    perChatMemory,
    recentDialogue,
    partnerName,
    currentFullName
  );

  return {
    selectedDialogue: budgetedDialogue,
    immediateContext,
    isShortFollowUp,
    hasPronouns,
    isTopicSwitched,
    detectedTopic: incomingKeywords.slice(0, 3).join(', ') || undefined,
    prunedMemoryDirective: prunedDirective,
  };
}

// ============================================================================
// PHASE 6 — AI PERFORMANCE & COST OPTIMIZATION SYSTEM IMPLEMENTATION
// ============================================================================

/**
 * Phase 6: Compact Personality Directive Builder
 * Converts per-chat personality into a structured, highly token-efficient representation
 * that saves ~70% of personality tokens while preserving 100% of persona guidelines.
 */
export function buildCompactPersonalityDirective(
  personality: PerChatPersonality,
  detectedDialect: DetectedDialect
): string {
  const rel = personality.relationship || 'unknown';
  const relGuidance =
    rel === 'unknown'
      ? 'unknown (Do NOT invent, guess, or assume any unstated relationship)'
      : rel;

  const formalityNote =
    personality.formality === 'high'
      ? 'High (respectful "aap"/"ji" phrasing where applicable)'
      : personality.formality === 'low'
      ? 'Low (casual everyday "tu"/"tum" phrasing)'
      : 'Medium (comfortable everyday "tum")';

  const emojiNote =
    personality.emojiFrequency === 'off'
      ? 'OFF (STRICT: Zero emojis allowed)'
      : personality.emojiFrequency === 'low'
      ? 'Low (rare, at most 1 in 4-5 messages or none)'
      : personality.emojiFrequency === 'high'
      ? 'High (1-2 natural emojis max)'
      : 'Normal (sparingly)';

  return `==================== COMPACT PERSONALITY PROFILE (PHASE 6) ====================
- Relationship: ${relGuidance}
- Tone: ${personality.tone} | Formality: ${formalityNote}
- Brevity: ${personality.brevity} | Emoji: ${emojiNote}
- Communication Style: ${personality.communicationStyle}
- Language & Dialect Target: ${detectedDialect.name}
  * Guideline: ${detectedDialect.guidelines}`;
}

export interface OptimizedAIContextParams {
  currentMessage: string;
  immediateContext: SmartContextDialogueItem[];
  recentDialogue?: Array<{ senderName: string; text: string; isCurrentUser: boolean }>;
  recentContext?: SmartContextDialogueItem[];
  selectedDialogue?: SmartContextDialogueItem[];
  memoryDirective: string;
  personality: PerChatPersonality;
  detectedDialect: DetectedDialect;
  partnerName: string;
  currentFullName: string;
}

export interface OptimizedAIContextResult {
  optimizedDialogue: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  optimizedMemoryDirective: string;
  compactPersonalityDirective: string;
  metrics: {
    totalInputMessages: number;
    selectedMessageCount: number;
    estimatedTokens: number;
    memoryFactsCount: number;
    dedupCount: number;
  };
}

/**
 * Phase 6: Final Context, Memory, Personality & Request Optimization Layer.
 * Prepares the most compact, token-efficient, and non-redundant prompt payload
 * before calling Gemini 1.5 Flash:
 * 1. Deduplicates memory facts that are already discussed in recent messages
 * 2. Compresses personality instructions into high-density structured directives
 * 3. Truncates dialogue messages at whole-message boundaries to enforce strict token budget
 * 4. Produces clean, alternating user/model turns without duplicate synthetic turns
 * 5. Collects real-time optimization metrics for dev monitoring
 */
export function optimizeAIContext(params: OptimizedAIContextParams): OptimizedAIContextResult {
  const {
    currentMessage,
    immediateContext,
    recentDialogue = [],
    selectedDialogue = [],
    memoryDirective,
    personality,
    detectedDialect,
    partnerName,
    currentFullName,
  } = params;

  let dedupCount = 0;

  // 1. MEMORY OPTIMIZATION & DEDUPLICATION AGAINST RECENT CONTEXT (Sections 4 & 6)
  // Extract memory lines and omit any that are already explicitly covered in recent dialogue
  const recentCombinedText = recentDialogue
    .slice(-6)
    .map((d) => d.text.toLowerCase())
    .join(' ');
  const incomingLower = (currentMessage || '').toLowerCase();

  const rawMemoryLines = (memoryDirective || '').split('\n').filter((l) => l.trim().length > 0);
  const preservedMemoryLines: string[] = [];

  let memoryFactsCount = 0;

  for (const line of rawMemoryLines) {
    const trimmed = line.trim();
    // Headers or section labels
    if (
      trimmed.startsWith('- Immediate Ongoing Topic:') ||
      trimmed.startsWith('- Active Temporary Context:')
    ) {
      preservedMemoryLines.push(trimmed);
      continue;
    }
    if (trimmed.startsWith('- RECENT OVERRIDE:')) {
      // Overrides must ALWAYS be preserved (Rule 19 / Conflict resolution)
      preservedMemoryLines.push(trimmed);
      continue;
    }
    if (trimmed.startsWith('* [') || trimmed.startsWith('- Verified Facts:')) {
      if (trimmed.startsWith('* [')) {
        memoryFactsCount++;
        // Check if fact is already stated in recent messages or incoming message
        const factContent = trimmed.replace(/^\*\s*\[.*?\]:\s*/, '').toLowerCase();
        const keywords = extractContextKeywords(factContent);
        if (keywords.length >= 2) {
          const matchedInRecent = keywords.filter(
            (k) => recentCombinedText.includes(k) || incomingLower.includes(k)
          );
          // If almost all keywords already exist in active recent dialogue, omit duplicate fact from Gemini prompt
          if (matchedInRecent.length >= keywords.length && matchedInRecent.length >= 2) {
            dedupCount++;
            continue; // Deduplicated!
          }
        }
      }
      preservedMemoryLines.push(trimmed);
      continue;
    }
    // Other lines (e.g. preferences, relationship if established)
    if (trimmed.includes('Communication Preference:') || trimmed.includes('Established Relationship:')) {
      preservedMemoryLines.push(trimmed);
    }
  }

  const optimizedMemoryDirective = preservedMemoryLines.join('\n').trim();

  // 2. COMPACT PERSONALITY DIRECTIVE (Section 5)
  const compactPersonalityDirective = buildCompactPersonalityDirective(personality, detectedDialect);

  // 3. SMART MESSAGE TRUNCATION (Section 7)
  // Strict rules:
  // - Current message always preserved
  // - Immediate context preserved
  // - Relevant older messages preserved
  // - Whole message boundaries ONLY (never cut mid-sentence or mid-word)
  // - Token budget: max ~1200 characters of dialogue turns
  let candidateDialogue = [...selectedDialogue];

  // If candidate dialogue is empty, fall back to immediate context
  if (candidateDialogue.length === 0 && immediateContext.length > 0) {
    candidateDialogue = [...immediateContext];
  }

  const MAX_DIALOGUE_CHARS = 1200;
  let totalChars = candidateDialogue.reduce((acc, item) => acc + item.text.length, 0);

  // Truncate from the oldest message first, dropping the ENTIRE message at boundary
  while (totalChars > MAX_DIALOGUE_CHARS && candidateDialogue.length > immediateContext.length) {
    const dropped = candidateDialogue.shift();
    if (dropped) {
      totalChars -= dropped.text.length;
      dedupCount++;
    }
  }

  // 4. ALTERNATING USER/MODEL CONVERSATION TURNS
  // Gemini API requires alternating turns starting with 'user'
  const rawTurns: Array<{ role: 'user' | 'model'; text: string }> = [];

  for (const item of candidateDialogue) {
    if (item.isCurrentUser) {
      rawTurns.push({
        role: 'model',
        text: item.text,
      });
    } else {
      rawTurns.push({
        role: 'user',
        text: `${item.senderName}: ${item.text}`,
      });
    }
  }

  // Target current unanswered incoming message (Priority 1 — NEVER LOST, WHOLE MESSAGE)
  rawTurns.push({
    role: 'user',
    text: `${partnerName}: ${currentMessage}`,
  });

  // Consolidate adjacent turns with the same role into parts
  const consolidated: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  for (const turn of rawTurns) {
    if (consolidated.length > 0 && consolidated[consolidated.length - 1].role === turn.role) {
      consolidated[consolidated.length - 1].parts.push({ text: turn.text });
    } else {
      consolidated.push({
        role: turn.role,
        parts: [{ text: turn.text }],
      });
    }
  }

  // Ensure first turn is 'user'
  if (consolidated.length > 0 && consolidated[0].role !== 'user') {
    consolidated.unshift({
      role: 'user',
      parts: [{ text: 'Hey' }],
    });
  }

  // Calculate approximate tokens (~4 characters per token)
  const totalCharsPrompt =
    compactPersonalityDirective.length +
    optimizedMemoryDirective.length +
    consolidated.reduce((acc, t) => acc + t.parts.reduce((pAcc, p) => pAcc + p.text.length, 0), 0);
  const estimatedTokens = Math.ceil(totalCharsPrompt / 4);

  const metrics = {
    totalInputMessages: recentDialogue.length + 1,
    selectedMessageCount: candidateDialogue.length + 1,
    estimatedTokens,
    memoryFactsCount,
    dedupCount,
  };

  return {
    optimizedDialogue: consolidated,
    optimizedMemoryDirective,
    compactPersonalityDirective,
    metrics,
  };
}


