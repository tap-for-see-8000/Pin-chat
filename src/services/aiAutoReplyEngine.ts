/**
 * PIN Chat - Stealth AI Auto-Reply Engine
 * Package: com.aistudio.pinchat.kpmd
 * 
 * Technical Implementation:
 * 1. Strict Eligibility & Anti-Loop Pipeline Trigger Filters
 * 2. 2.5s Multi-Message Debounce per chatId
 * 3. 3-Layer Context Assembly (Memory Summary, Chronological History, Target Messages)
 * 4. Gemini 1.5 Flash with Anti-Filler Rules & Strict Persona Tuning
 * 5. Stealth Typing & Human Timing Engine (2.2s - 6.8s delay)
 * 6. Atomic Database Commit & Safe Finally Cleanup
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

    // LAYER B: Recent 35 Chronological Messages (Both User A and User B)
    const recentDialogue: Array<{ senderName: string; text: string; isCurrentUser: boolean }> = [];
    if (db) {
      try {
        const messagesColl = collection(db, 'chats', chatId, 'messages');
        const q = query(messagesColl, orderBy('createdAt', 'desc'), limit(35));
        const snap = await getDocs(q);

        const fetched: ChatMessage[] = [];
        snap.forEach((d) => {
          const data = d.data();
          fetched.push({
            messageId: d.id,
            chatId,
            senderUsername: data.senderUsername || '',
            senderName: data.senderName || '',
            text: data.text || '',
            createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
          });
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

    // LAYER C: Target Unanswered Messages from Partner
    const bundledPartnerText = targetMessages.map((m) => m.text).join('\n');
    const partnerName = targetUser.fullName || targetUser.username;

    // 4. GEMINI 1.5 FLASH SYSTEM INSTRUCTION & STRICT QUALITY CONTROLS
    const styleProfiles: Record<AutoReplyStyle, string> = {
      friend:
        'Warm, witty, relaxed, authentic friendly vibe. Talk like an everyday close friend.',
      casual:
        'Chill, casual, natural, brief, everyday texting tone.',
      supportive:
        'Empathetic, caring, thoughtful, emotionally supportive, attentive.',
      professional:
        'Courteous, articulate, prompt, polite, reliable, professional.',
    };

    const chosenStyleDescription = styleProfiles[settings.style] || styleProfiles.friend;

    const systemInstruction = `You are strictly acting on behalf of ${currentFullName} (@${currentUsername}) replying to your chat partner ${partnerName} (@${cleanPartnerUser}) in a private 1-on-1 chat.
Tone & Persona: ${chosenStyleDescription}

MANDATORY RULES:
1. Speak strictly in the authentic voice of ${currentFullName}. NEVER acknowledge or reveal that you are an AI, machine, bot, or virtual assistant.
2. STRICT ANTI-FILLER RULE: Zero repetition of dry generic fillers (such as "हाँ भाई", "ठीक है", "अच्छा", "मैं सुन रहा हूँ", "हाँ जी", "Sure thing", "Understood") unless directly answering a yes/no question. Always reply with genuine substance, authentic human emotion, and relevance.
3. UNDERSTAND FULL DIALOGUE: Read the entire conversation history to understand context, but formulate your response ONLY addressing the partner's latest incoming message(s).
4. SPECIFIC QUESTIONS: If the partner asked a question, provide a direct contextual answer, plus an optional natural follow-up thought (do not force questions).
5. NO HALLUCINATIONS: Strictly prohibit hallucinating or inventing specific personal facts, secret locations, or commitments not grounded in the chat history.
6. LANGUAGE MATCHING: Match the exact language of the partner (Hindi, Hinglish, or English) naturally.
7. LENGTH: Keep response brief and realistic: 1 to 2 sentences (maximum 3 short sentences), exactly like a real person typing on a smartphone.`;

    let generatedReply = '';

    const apiKey =
      (import.meta.env.VITE_GEMINI_API_KEY as string) ||
      (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '') ||
      '';

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        // Build context contents
        const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

        if (memorySummary) {
          contents.push({
            role: 'user',
            parts: [{ text: `[Long-term memory recap of past chats: ${memorySummary}]` }],
          });
          contents.push({
            role: 'model',
            parts: [{ text: 'Understood the background context.' }],
          });
        }

        // Add recent dialogue history
        if (recentDialogue.length > 0) {
          // Take up to last 20 for prompt
          const sliceHistory = recentDialogue.slice(-20);
          for (const item of sliceHistory) {
            contents.push({
              role: item.isCurrentUser ? 'model' : 'user',
              parts: [{ text: `${item.senderName}: ${item.text}` }],
            });
          }
        }

        // Add Target Unanswered Message
        contents.push({
          role: 'user',
          parts: [{ text: `${partnerName}: ${bundledPartnerText}` }],
        });

        const response = await ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
            maxOutputTokens: 250,
          },
        });

        generatedReply = response.text?.trim() || '';
      } catch (geminiErr) {
        console.warn('[AutoReplyEngine] Gemini generation note:', geminiErr);
      }
    }

    // Smart contextual fallback if API key is missing or failed (Never dry generic filler)
    if (!generatedReply) {
      generatedReply = generateSmartFallbackReply(bundledPartnerText, settings.style, partnerName);
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

    // Broadcast new message
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
 * High-quality contextual fallback responses matching user tone without repeating dry fillers
 */
function generateSmartFallbackReply(
  partnerText: string,
  style: AutoReplyStyle,
  partnerName: string
): string {
  const lower = partnerText.toLowerCase();

  const isQuestion =
    partnerText.includes('?') ||
    lower.includes('kahan') ||
    lower.includes('where') ||
    lower.includes('kab') ||
    lower.includes('when') ||
    lower.includes('kaise') ||
    lower.includes('how') ||
    lower.includes('kya');

  if (style === 'friend') {
    if (isQuestion) {
      return 'Haan, bas thoda sa busy tha! Bol, kya chal raha hai?';
    }
    return 'Mast! Main bhi yahi dekh raha tha, thodi der me connect karte hain.';
  }

  if (style === 'casual') {
    if (isQuestion) {
      return 'Just wrapped up some work. Everything good on your side?';
    }
    return 'Sounds good! Catch you in a bit.';
  }

  if (style === 'supportive') {
    if (isQuestion) {
      return 'Take your time, no rush at all! Hope your day is going peacefully.';
    }
    return 'I completely understand! Always here if you want to chat more.';
  }

  // Professional
  if (isQuestion) {
    return 'Thank you for reaching out. I have noted this and will review the details shortly.';
  }
  return 'Thank you for the update. I will keep this in mind and follow up accordingly.';
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
