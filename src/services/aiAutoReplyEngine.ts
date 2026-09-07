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

/**
 * 1. PIPELINE TRIGGER FILTER (MUST RUN FIRST)
 * Returns false immediately if message is not eligible for auto-reply.
 */
export function checkMessageEligibility(
  message: ChatMessage,
  currentUsername: string,
  settings?: { enabled: boolean; style: AutoReplyStyle }
): boolean {
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

  if (inFlightMessageIds.has(message.messageId)) {
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
    // LAYER A: Long-Term Memory Summary
    let memorySummary = '';
    if (db) {
      try {
        const chatDocRef = doc(db, 'chats', chatId);
        const chatSnap = await getDoc(chatDocRef);
        if (chatSnap.exists()) {
          const chatData = chatSnap.data() as ChatSession;
          if (chatData.memorySummary) {
            memorySummary = chatData.memorySummary;
          }
        }
      } catch (err) {
        console.warn('[AutoReplyEngine] Memory summary read note:', err);
      }
    }

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

    // 4. SYSTEM INSTRUCTION & HUMAN-LIKE NATURAL CHAT DIRECTIVES
    const styleProfiles: Record<AutoReplyStyle, string> = {
      friend: 'Warm, relaxed, witty, and authentic friendly texting vibe.',
      casual: 'Laid-back, chill, very brief, everyday texting tone.',
      supportive: 'Thoughtful, caring, empathetic, warm, and attentive.',
      professional: 'Polite, clear, helpful, courteous, without being stiff or robotic.',
    };

    const chosenStyleDescription = styleProfiles[settings.style] || styleProfiles.friend;

    const systemInstruction = `You are secretly texting as ${currentFullName} (@${currentUsername}) to ${partnerName} (@${cleanPartnerUser}) on a personal messaging app.

Persona:
A real human texting back casually. Style: ${chosenStyleDescription}.

Length Rule:
Mirror the brevity of the incoming message. Very short questions receive very short answers.
If the partner writes 1-5 words, reply in 2-8 words.
Default behavior must be SHORT, NATURAL, and PUNCHY. Never write essays, paragraphs, bullet points, or robotic explanations.

Language Rule:
Match the incoming language and dialect closely: Hinglish, Hindi (Devanagari script), Bhojpuri/regional language, or casual English.
Never switch language unless the partner initiates a switch.
Never use overly formal English (e.g., use "I'm at home", NOT "I am currently at my residence").

Context Rule:
Read both sides of the recent conversation to understand the situation, but generate a response ONLY to the partner's current incoming message.
Never reply to ${currentFullName}'s own previous messages as if they were questions.

Human Rule:
Sound natural, casual, spontaneous, and conversational like someone quickly typing on a smartphone.
Natural conversational words like "haan", "acha", "arey", "hmm", "haan bol", "bata", "theek", "sahi", "lol", "yaar", "bhai" are allowed when appropriate, but do not spam them.
Use emojis very sparingly and only when the tone truly fits. Strictly avoid putting an emoji in every single reply.

Zero-Context Rule:
If conversation history is empty or this is a brand new chat, do not be confused or apologize.
Answer greetings or ice-breakers naturally:
- "Hi" / "Hey" -> "Haan bol" or "Hey, kya haal?"
- "Kaha ho?" -> "Ghar pe hu"
- "Kya kar rahe?" -> "Bas baitha hu"
- "Aur batao" -> "Bas badhiya, tu bata"

Factual Grounding:
Do not invent specific fake locations, cities, or commitments unless mentioned in the chat.
If you don't know where you are or what's happening, say "Yahin hu, bol" or "Bas idhar hi, kya hua?".

If you don't know something or lack information:
Respond naturally like a friend: "Yaad nahi abhi", "Nahi pata bhai", "Pata nahi yaar", "Haan, shayad", "Achha?", "Kya hua?", "Bata na".

ABSOLUTE NEGATIVE CONSTRAINTS (STRICTLY FORBIDDEN):
- Never mention or hint that you are an AI, bot, assistant, machine, system, or automated program.
- Never use technical, system-state, or connection phrases such as:
  "Thodi der me connect ho jayega", "Mai yahi hu dekh raha hu", "Mai yahi hu dekh rahi hu", "System check kar raha hu", "System check kar rahi hu", "Loading...", "Connecting...", "Connection ho raha hai", "Connect ho raha hai", "Context nahi mila", "Mujhe context nahi mila", "As an AI...", "AI ke according...", "Assistant...", "Bot...", "Main process kar raha hu", "Main analyze kar raha hu", "Request process...", "Please wait...", "Error...", "Technical issue...", "Server...", "Network...", "Data load...", "Conversation load...", "History available nahi...", or any generic excuses.
- Output ONLY the raw human message text. Do not wrap in quotation marks. Do not prepend speaker names or labels.`;

    let generatedReply = '';

    const apiKey =
      (import.meta.env.VITE_GEMINI_API_KEY as string) ||
      (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '') ||
      '';

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        // Build valid alternating conversation turns for Gemini
        const contents = buildAlternatingContents(
          memorySummary,
          recentDialogue,
          partnerName,
          bundledPartnerText
        );

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
        generatedReply = cleanAndSanitizeReply(
          rawOutput,
          bundledPartnerText,
          settings.style,
          partnerName,
          currentFullName,
          currentUsername
        );
      } catch (geminiErr) {
        console.warn('[AutoReplyEngine] Gemini generation note:', geminiErr);
      }
    }

    // Smart contextual fallback if API key is missing or failed (Never dry generic filler or bot phrases)
    if (!generatedReply) {
      generatedReply = generateSmartFallbackReply(
        bundledPartnerText,
        settings.style,
        partnerName
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
 * Builds alternating user/model content blocks for the Gemini API
 */
function buildAlternatingContents(
  memorySummary: string,
  recentDialogue: Array<{ senderName: string; text: string; isCurrentUser: boolean }>,
  partnerName: string,
  bundledPartnerText: string
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  const rawTurns: Array<{ role: 'user' | 'model'; text: string }> = [];

  if (memorySummary) {
    rawTurns.push({
      role: 'user',
      text: `[Context from past chats: ${memorySummary}]`,
    });
    rawTurns.push({
      role: 'model',
      text: 'Got it.',
    });
  }

  // Recent history (take up to last 16 messages)
  const historySlice = recentDialogue.slice(-16);
  for (const item of historySlice) {
    rawTurns.push({
      role: item.isCurrentUser ? 'model' : 'user',
      text: `${item.senderName}: ${item.text}`,
    });
  }

  // Target current unanswered incoming message
  rawTurns.push({
    role: 'user',
    text: `${partnerName}: ${bundledPartnerText}`,
  });

  // Consolidate adjacent turns with same role to ensure strict alternating turns
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

  return consolidated;
}

/**
 * Cleans, sanitizes, and filters model outputs.
 * Strips quotes, speaker prefixes, markdown, and discards any forbidden bot phrases.
 */
function cleanAndSanitizeReply(
  rawText: string,
  incomingText: string,
  style: AutoReplyStyle,
  partnerName: string,
  currentFullName: string,
  currentUsername: string
): string {
  if (!rawText) {
    return generateSmartFallbackReply(incomingText, style, partnerName);
  }

  let cleaned = rawText.trim();

  // 1. Remove wrapping quotes ("...", '...', “...”, «...»)
  cleaned = cleaned.replace(/^["'“”«»]+|["'“”«»]+$/g, '').trim();

  // 2. Remove common AI/speaker prefixes like "Suman:", "Assistant:", "AI:", "Bot:", "Me:", "@username:"
  const prefixRegex = new RegExp(
    `^(?:${escapeRegex(currentFullName)}|${escapeRegex(currentUsername)}|assistant|ai|bot|model|me|you|system)\\s*:\\s*`,
    'i'
  );
  cleaned = cleaned.replace(prefixRegex, '').trim();

  // 3. Remove markdown formatting like **bold**, *italics*, `code`
  cleaned = cleaned.replace(/[*_~`]/g, '').trim();

  // 4. Remove surrounding quotes again if newly exposed
  cleaned = cleaned.replace(/^["'“”«»]+|["'“”«»]+$/g, '').trim();

  // 5. Check against forbidden bot / system phrases
  const FORBIDDEN_PATTERNS = [
    /connect\s*ho\s*jayega/i,
    /connect\s*karte\s*hain/i,
    /mai\s*yahi\s*hu\s*dekh\s*raha/i,
    /mai\s*yahi\s*hu\s*dekh\s*rahi/i,
    /yahi\s*dekh\s*raha\s*tha/i,
    /system\s*check/i,
    /loading/i,
    /connecting/i,
    /connection\s*ho\s*raha/i,
    /connect\s*ho\s*raha/i,
    /context\s*nahi\s*mila/i,
    /mujhe\s*context/i,
    /as\s*an\s*ai/i,
    /ai\s*ke\s*according/i,
    /\bassistant\b/i,
    /\bbot\b/i,
    /main\s*process\s*kar\s*raha/i,
    /main\s*analyze\s*kar\s*raha/i,
    /request\s*process/i,
    /please\s*wait/i,
    /\berror\b/i,
    /technical\s*issue/i,
    /\bserver\b/i,
    /\bnetwork\b/i,
    /data\s*load/i,
    /conversation\s*load/i,
    /history\s*available\s*nahi/i,
    /language\s*model/i,
    /virtual\s*assistant/i,
    /artificial\s*intelligence/i,
    /i\s*am\s*an\s*ai/i,
    /i\s*don'?t\s*have\s*(enough\s*)?context/i,
    /can\s*you\s*provide\s*more\s*information/i,
  ];

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(cleaned)) {
      console.warn('[AutoReplyEngine] Forbidden bot phrase detected, replacing with natural fallback:', cleaned);
      return generateSmartFallbackReply(incomingText, style, partnerName);
    }
  }

  // 6. If result is empty after cleaning
  if (!cleaned) {
    return generateSmartFallbackReply(incomingText, style, partnerName);
  }

  return cleaned;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Natural, human-like contextual fallback engine.
 * Never uses technical phrases, connection excuses, or robotic templates.
 * Strictly matches dialect (Hindi, Bhojpuri, Hinglish, English) and length.
 */
function generateSmartFallbackReply(
  partnerText: string,
  style: AutoReplyStyle,
  _partnerName: string
): string {
  const text = (partnerText || '').trim();
  const lower = text.toLowerCase();

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  // 1. Detect Script / Dialect
  const hasDevanagari = /[\u0900-\u097F]/.test(text);

  const isBhojpuri =
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

  // 2. Bhojpuri Dialect Responses
  if (isBhojpuri) {
    if (text.includes('कहाँ') || lower.includes('kahan') || lower.includes('kaha')) {
      return pick(['घरे बानी', 'बस घरे बानी', 'यहीं बानी, बोला']);
    }
    if (text.includes('का हाल') || lower.includes('haal')) {
      return pick(['सब बढ़िया बा', 'सब बढ़िया बा, आपन बतावा', 'एकदम मस्त बा']);
    }
    if (text.includes('का करता') || lower.includes('karat')) {
      return pick(['बस बइठल बानी', 'कुछु ना, बस बइठल बानी', 'काम करत बानी']);
    }
    return pick(['हाँ बोला', 'सब ठीक बा', 'हाँ, का बात बा?']);
  }

  // 3. Pure Hindi / Devanagari Script Responses
  if (hasDevanagari) {
    if (style === 'professional') {
      if (text.includes('कहाँ')) return 'कार्यालय में हूँ। बताइए?';
      if (text.includes('नमस्ते') || text.includes('प्रणाम') || text.includes('हेलो')) {
        return 'नमस्ते! कहिए, कैसे मदद कर सकता हूँ?';
      }
      return 'जी, मैंने देख लिया। कुछ समय में उत्तर देता हूँ।';
    }

    // Greetings
    if (text.includes('नमस्ते') || text.includes('हेलो') || text.includes('हाय') || text === 'हाँ') {
      return pick(['हाँ बोलो', 'हे, कैसे हो?', 'हाँ जी, बताइए']);
    }
    // Location
    if (text.includes('कहाँ') || text.includes('किधर')) {
      return pick(['घर पर हूँ', 'बस घर पे हूँ', 'यहीं हूँ, बोलो', 'घर पर ही हूँ']);
    }
    // Activity
    if (text.includes('क्या कर') || text.includes('क्या हो')) {
      return pick(['बस बैठा हूँ', 'कुछ नहीं, बस बैठा हूँ', 'बस फ्री हूँ अभी, तुम बताओ']);
    }
    // Status / General
    if (text.includes('और बताओ') || text.includes('और?') || text.includes('क्या हाल')) {
      return pick(['सब बढ़िया, तुम बताओ', 'बस सब ठीक है, तुम सुनाओ', 'सब मस्त']);
    }
    // Free / availability
    if (text.includes('फ्री')) {
      return pick(['हाँ, बोलो', 'हाँ फ्री हूँ, बताओ']);
    }

    // Default short Devanagari human reply
    return pick(['हाँ बोलो', 'अच्छा? क्या हुआ?', 'सब ठीक, तुम बताओ', 'बताओ ना']);
  }

  // 4. English Detection (No common Hinglish markers)
  const hinglishMarkers = ['kaha', 'kahan', 'kidhar', 'kya', 'bhai', 'yaar', 'bata', 'aur', 'suno', 'sun', 'theek', 'thik', 'hai', 'babu', 'batao', 'achha', 'acha', 'sab'];
  const hasHinglishMarker = hinglishMarkers.some((w) => lower.includes(w));
  const isEnglish = !hasHinglishMarker && /^[a-z0-9\s.,!?'"()_-]+$/i.test(text);

  if (isEnglish) {
    if (style === 'professional') {
      if (lower.includes('where')) return 'Currently at my desk, please let me know.';
      if (lower.includes('hi') || lower.includes('hello')) return 'Hello, hope you are doing well.';
      return 'Noted, I will review and follow up shortly.';
    }

    // Greetings
    if (lower === 'hi' || lower === 'hello' || lower === 'hey' || lower === 'hii' || lower === 'yo') {
      return pick(['Hey! What’s up?', 'Hey, how’s it going?', 'Hey, all good?']);
    }
    // Location
    if (lower.includes('where') || lower.includes('where are you') || lower.includes('where r u')) {
      return pick(['At home, what’s up?', 'I’m at home', 'Around here, tell me']);
    }
    // Activity
    if (lower.includes('doing') || lower.includes('wyd') || lower.includes('sup') || lower.includes("what's up")) {
      return pick(['Not much, just chilling. You?', 'Nothing much, you?', 'Just wrapped up. What’s up?']);
    }
    // Status
    if (lower.includes('how are you') || lower.includes('how r u')) {
      return pick(['Doing good, you?', 'All good here! How about you?']);
    }
    // Free
    if (lower.includes('free')) {
      return pick(['Yeah, tell me', 'Yeah, what’s up?']);
    }

    return pick(['Yeah, tell me', 'All good, what about you?', 'Not much, tell me']);
  }

  // 5. Hinglish (Casual, Everyday Texting - Default)
  if (style === 'professional') {
    if (lower.includes('kaha') || lower.includes('kahan')) {
      return 'Office me hu. Bataiye kya kaam tha?';
    }
    if (lower.includes('hi') || lower.includes('hello')) {
      return 'Hello, hope all is well. Bataiye?';
    }
    return 'Noted. Main thoda dekh kar update karta hu.';
  }

  // Greetings / Ice-breakers
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
    return pick(['Haan bol 😄', 'Haan bol', 'Hey, kya haal?', 'Haan bolo', 'Bol na']);
  }

  // Location questions
  if (
    lower.includes('kaha') ||
    lower.includes('kahan') ||
    lower.includes('kidhar') ||
    lower.includes('where')
  ) {
    return pick(['Ghar pe hu', 'Bas ghar pe', 'Yahin hu, bol', 'Ghar pe hi hu']);
  }

  // Activity questions
  if (
    lower.includes('kya kar') ||
    lower.includes('kya chal') ||
    lower.includes('wyd') ||
    lower.includes('scene')
  ) {
    return pick([
      'Bas baitha hu',
      'Kuch khaas nahi, tu bata',
      'Bas baitha hu, tu bol',
      'Kuch nahi yaar, tu bata',
    ]);
  }

  // Status / Conversation starters
  if (
    lower.includes('aur batao') ||
    lower.includes('aur bata') ||
    lower === 'aur' ||
    lower === 'aur?' ||
    lower.includes('kya haal')
  ) {
    return pick([
      'Bas badhiya, tu bata',
      'Sab sahi hai, tu bol',
      'Bas chal raha hai, tu bata',
      'Sab mast, tu bata',
    ]);
  }

  // Availability / Quick questions
  if (lower.includes('free hai') || lower.includes('free ho') || lower.includes('busy')) {
    return pick(['Haan, bol', 'Haan free hu, bata', 'Haan bol na']);
  }

  // Single word acknowledgments
  if (lower === 'hmm' || lower === 'hm') {
    return pick(['Kya soch raha?', 'Aur bata', 'Haan']);
  }
  if (lower === 'haan' || lower === 'han' || lower === 'ha') {
    return pick(['Aur bata', 'Sahi hai', 'Haan']);
  }
  if (lower === 'acha' || lower === 'achha' || lower === 'ok' || lower === 'theek') {
    return pick(['Haan', 'Aur bata kya scene hai?', 'Sahi hai']);
  }

  // Unclear context / Missing info human response
  return pick([
    'Haan bol',
    'Bas yahi hu, bol',
    'Achha? Kya hua?',
    'Bata na',
    'Nahi pata yaar',
    'Yaad nahi abhi',
  ]);
}

/**
 * Reads or updates the chat's Auto-Reply settings in Firestore and localStorage
 */
export async function saveChatAutoReplySettings(
  chatId: string,
  username: string,
  enabled: boolean,
  style: AutoReplyStyle
): Promise<void> {
  const cleanUsername = username.trim().toLowerCase();

  // Save in local storage
  try {
    const key = `pinchat_autoreply_${chatId}_${cleanUsername}`;
    localStorage.setItem(key, JSON.stringify({ enabled, style }));
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
 * Retrieves chat auto-reply settings (defaults to enabled: true, style: 'friend')
 */
export function getChatAutoReplySettings(
  chatId: string,
  username: string
): { enabled: boolean; style: AutoReplyStyle } {
  const cleanUsername = username.trim().toLowerCase();
  try {
    const key = `pinchat_autoreply_${chatId}_${cleanUsername}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
        style: parsed.style || 'friend',
      };
    }
  } catch {
    // ignore
  }

  // Default: Auto-Reply ON (true) and style 'friend'
  return {
    enabled: true,
    style: 'friend',
  };
}

