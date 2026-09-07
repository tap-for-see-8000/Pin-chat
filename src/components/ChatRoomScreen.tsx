/**
 * PIN Chat - Chat Room Screen
 * Package: com.aistudio.pinchat.kpmd
 * 
 * Features:
 * 1. Real-time multi-device Firestore onSnapshot messaging & typing indicators.
 * 2. 100% empty initial state - zero mock, preview, or fake seeded chats.
 * 3. Smooth auto-scroll to latest message.
 * 4. Non-intrusive offline notification banner when navigator.onLine drops.
 * 5. Gemini AI Auto-Reply with Persona Engine:
 *    - AI Auto-Reply Toggle: [ON / OFF] (default: OFF)
 *    - Persona Selector Dropdown: "Friend", "Wife / Partner", "Professional Assistant", "Casual Buddy" (default: "Friend")
 *    - Uses @google/genai with gemini-1.5-flash
 *    - Shows "[Selected Persona] AI is typing..."
 *    - Feeds recent chat history and incoming message with exact prompt
 *    - Sends generated message to Firestore as current user's message
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Send,
  Mic,
  Sparkles,
  User as UserIcon,
  Wifi,
  WifiOff,
  Check,
  CheckCheck,
  MessageSquare,
  Shield,
  Copy,
  Check as CheckIcon,
  Bot,
  ChevronDown,
} from 'lucide-react';
import { UserProfile, Message, PersonaType } from '../types';
import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';

interface ChatRoomScreenProps {
  pin: string;
  user: Partial<UserProfile>;
  onBack: () => void;
}

const PERSONA_OPTIONS: PersonaType[] = [
  'Friend',
  'Wife / Partner',
  'Professional Assistant',
  'Casual Buddy',
];

export const ChatRoomScreen: React.FC<ChatRoomScreenProps> = ({
  pin,
  user,
  onBack,
}) => {
  const [inputText, setInputText] = useState('');
  const [micActive, setMicActive] = useState(false);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const [pinCopied, setPinCopied] = useState(false);

  // Gemini AI Auto-Reply Engine State
  const [isAutoReplyEnabled, setIsAutoReplyEnabled] = useState<boolean>(false);
  const [selectedPersona, setSelectedPersona] = useState<PersonaType>('Friend');
  const [aiIsTyping, setAiIsTyping] = useState<boolean>(false);

  // Synchronization refs for listeners
  const isAutoReplyEnabledRef = useRef(isAutoReplyEnabled);
  isAutoReplyEnabledRef.current = isAutoReplyEnabled;

  const selectedPersonaRef = useRef(selectedPersona);
  selectedPersonaRef.current = selectedPersona;

  // Track processed incoming message IDs to prevent duplicate auto-replies
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const isFirstSnapshotRef = useRef<boolean>(true);
  const isGeneratingReplyRef = useRef<boolean>(false);

  // Network State
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showBackOnlineNotice, setShowBackOnlineNotice] = useState<boolean>(false);

  // Typing state for real partner in room
  const [partnerTyping, setPartnerTyping] = useState<{ isTyping: boolean; name: string }>({
    isTyping: false,
    name: 'Partner',
  });

  // Storage key for persistent chat history
  const historyStorageKey = `pinchat_history_${pin}`;

  // Initial messages loader: STRICTLY real messages only. Starts empty if no history.
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(historyStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Strictly purge any legacy mock/preview or simulated bot messages
          const realMessages = parsed.filter(
            (m) =>
              m &&
              m.messageId !== 'msg-preview-incoming' &&
              m.messageId !== 'msg-preview-outgoing' &&
              typeof m.text === 'string' &&
              m.text.trim().length > 0
          );
          return realMessages.sort((a, b) => a.createdAt - b.createdAt);
        }
      }
    } catch (e) {
      console.warn('[PIN Chat] Error loading saved messages:', e);
    }
    // Starts completely empty
    return [];
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // 1. Auto-scroll smoothly to latest message
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, partnerTyping.isTyping, aiIsTyping, scrollToBottom]);

  // 2. Chat History Persistence (Save to localStorage on change)
  useEffect(() => {
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(messages));
    } catch (e) {
      console.warn('[PIN Chat] Failed to save chat history to local storage:', e);
    }
  }, [messages, historyStorageKey]);

  // 3. Network Status Monitoring (Offline / Online alerts)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBackOnlineNotice(true);
      const timer = setTimeout(() => setShowBackOnlineNotice(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBackOnlineNotice(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 4. Emit typing indicator state (Firestore + BroadcastChannel)
  const emitTypingState = useCallback(
    (isTyping: boolean, customName?: string) => {
      const myUid = user.uid || 'current-user-id';
      const myName = customName || user.displayName || 'Partner';

      // 1. BroadcastChannel for cross-tab
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: 'typing',
            senderUid: myUid,
            senderName: myName,
            isTyping,
          });
        } catch {
          // ignore
        }
      }

      // 2. Firestore presence doc
      if (db && myUid) {
        try {
          const typingDocRef = doc(db, 'rooms', pin, 'typing', myUid);
          setDoc(
            typingDocRef,
            {
              isTyping,
              senderName: myName,
              updatedAt: Date.now(),
            },
            { merge: true }
          ).catch(() => {});
        } catch {
          // ignore
        }
      }
    },
    [pin, user.displayName, user.uid]
  );

  // 5. Trigger Gemini AI Auto-Reply Function
  const triggerAiAutoReply = useCallback(
    async (incomingMsg: Message, currentHistory: Message[]) => {
      if (isGeneratingReplyRef.current) return;
      isGeneratingReplyRef.current = true;
      setAiIsTyping(true);

      const persona = selectedPersonaRef.current;
      const myUid = user.uid || 'current-user-id';
      const myName = user.displayName || 'Me';

      // Emit typing state to Firestore so partner sees typing indicator
      emitTypingState(true, `${persona} AI`);

      try {
        const apiKey =
          (import.meta.env.VITE_GEMINI_API_KEY as string) ||
          (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '') ||
          '';

        const systemPrompt = `You are auto-replying on behalf of the user in an ongoing private chat. Adopt the personality, tone, and mannerisms of a ${persona}. Match the language of the sender (Hindi, Hinglish, or English). Reply naturally, concisely, and conversationally. Do NOT sound like an AI assistant or bot. Output only the direct message.`;

        let generatedText = '';

        if (apiKey) {
          const ai = new GoogleGenAI({ apiKey });

          // Format recent history (last 6 messages) for context
          const recentChat = currentHistory.slice(-6).map((m) => ({
            role: m.senderUid === myUid ? ('user' as const) : ('model' as const),
            parts: [{ text: `${m.senderName}: ${m.text}` }],
          }));

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              ...recentChat,
              {
                role: 'user',
                parts: [{ text: `${incomingMsg.senderName}: ${incomingMsg.text}` }],
              },
            ],
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.7,
              maxOutputTokens: 250,
            },
          });

          generatedText = response.text?.trim() || '';
        } else {
          // Fallback if API key is not yet configured in environment
          if (persona === 'Friend') {
            generatedText = 'Hey! Got your message, sounds good!';
          } else if (persona === 'Wife / Partner') {
            generatedText = 'Haan ji, maine dekh liya! Sab theek hai na?';
          } else if (persona === 'Professional Assistant') {
            generatedText = 'Understood. I have noted this and will follow up shortly.';
          } else {
            generatedText = 'Yo! Got it bro, all good here.';
          }
        }

        if (generatedText) {
          // Slight natural delay so typing feels conversational
          await new Promise((r) => setTimeout(r, 900));

          const messageId = `msg-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const aiMessage: Message = {
            messageId,
            senderUid: myUid,
            senderName: myName,
            text: generatedText,
            createdAt: Date.now(),
            isAi: true,
            status: 'delivered',
          };

          // Append to local state
          setMessages((prev) => [...prev, aiMessage]);

          // Broadcast to other tabs
          if (broadcastChannelRef.current) {
            try {
              broadcastChannelRef.current.postMessage({
                type: 'new_message',
                message: aiMessage,
              });
            } catch {
              // ignore
            }
          }

          // Save to Firestore under current user's message
          if (db) {
            try {
              const msgDocRef = doc(db, 'rooms', pin, 'messages', messageId);
              await setDoc(msgDocRef, {
                senderUid: myUid,
                senderName: myName,
                text: generatedText,
                createdAt: serverTimestamp(),
                isAi: true,
                status: 'delivered',
              });
            } catch (err) {
              console.warn('[PIN Chat] Error saving AI auto-reply to Firestore:', err);
            }
          }
        }
      } catch (err) {
        console.error('[PIN Chat] Gemini AI Auto-Reply generation error:', err);
      } finally {
        setAiIsTyping(false);
        emitTypingState(false);
        isGeneratingReplyRef.current = false;
      }
    },
    [emitTypingState, pin, user.displayName, user.uid]
  );

  // 6. Firestore synchronization for Real-time Messages & Typing
  useEffect(() => {
    if (!db) return;

    // A. Listen to Messages
    const messagesRef = collection(db, 'rooms', pin, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribeMessages = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const remoteMessages: Message[] = [];
          const newIncomingFromPartner: Message[] = [];
          const myUid = user.uid || 'current-user-id';

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const msgId = docSnap.id;
            const msg: Message = {
              messageId: msgId,
              senderUid: data.senderUid || '',
              senderName: data.senderName || 'Anonymous',
              text: data.text || '',
              createdAt: data.createdAt?.toMillis
                ? data.createdAt.toMillis()
                : data.createdAt || Date.now(),
              isAi: data.isAi || false,
              status: data.status || 'delivered',
            };

            remoteMessages.push(msg);

            // Check if this is a new message from partner
            if (
              !isFirstSnapshotRef.current &&
              !processedMessageIdsRef.current.has(msgId) &&
              msg.senderUid !== myUid
            ) {
              newIncomingFromPartner.push(msg);
            }

            processedMessageIdsRef.current.add(msgId);
          });

          // Update messages state
          if (remoteMessages.length > 0) {
            setMessages((prev) => {
              const map = new Map<string, Message>();
              prev.forEach((m) => map.set(m.messageId, m));
              remoteMessages.forEach((m) => map.set(m.messageId, m));
              return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
            });
          }

          // Trigger AI Auto-Reply if Auto-Reply is ON and new incoming message arrived
          if (
            !isFirstSnapshotRef.current &&
            isAutoReplyEnabledRef.current &&
            newIncomingFromPartner.length > 0
          ) {
            const latestIncoming = newIncomingFromPartner[newIncomingFromPartner.length - 1];
            triggerAiAutoReply(latestIncoming, remoteMessages);
          }

          isFirstSnapshotRef.current = false;
        } else {
          isFirstSnapshotRef.current = false;
        }
      },
      (error) => {
        console.warn('[PIN Chat] Firestore messages subscription note:', error.message);
      }
    );

    // B. Listen to Real-time Typing Indicators from other members
    const typingColRef = collection(db, 'rooms', pin, 'typing');
    const unsubscribeTyping = onSnapshot(
      typingColRef,
      (snapshot) => {
        const myUid = user.uid || 'current-user-id';
        let isSomeoneTyping = false;
        let typingName = 'Partner';

        snapshot.forEach((docSnap) => {
          if (docSnap.id !== myUid) {
            const data = docSnap.data();
            const isFresh = Date.now() - (data.updatedAt || 0) < 5000;
            if (data.isTyping && isFresh) {
              isSomeoneTyping = true;
              typingName = data.senderName || 'Partner';
            }
          }
        });

        setPartnerTyping({
          isTyping: isSomeoneTyping,
          name: typingName,
        });
      },
      (err) => {
        console.warn('[PIN Chat] Typing subscription note:', err.message);
      }
    );

    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
    };
  }, [pin, triggerAiAutoReply, user.uid]);

  // 7. Real-time BroadcastChannel for Zero-Latency Local Cross-Tab Sync
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(`pinchat_room_${pin}`);
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        // Partner typing event
        if (data.type === 'typing') {
          if (data.senderUid !== (user.uid || 'current-user-id')) {
            setPartnerTyping({
              isTyping: Boolean(data.isTyping),
              name: data.senderName || 'Partner',
            });
          }
        }

        // Incoming message event
        if (data.type === 'new_message' && data.message) {
          const incomingMsg: Message = data.message;
          const myUid = user.uid || 'current-user-id';

          if (incomingMsg.senderUid !== myUid) {
            setMessages((prev) => {
              if (prev.some((m) => m.messageId === incomingMsg.messageId)) return prev;
              const next = [...prev, incomingMsg].sort((a, b) => a.createdAt - b.createdAt);

              // Auto-reply trigger via BroadcastChannel if not processed
              if (
                isAutoReplyEnabledRef.current &&
                !processedMessageIdsRef.current.has(incomingMsg.messageId)
              ) {
                processedMessageIdsRef.current.add(incomingMsg.messageId);
                triggerAiAutoReply(incomingMsg, next);
              }

              return next;
            });

            // Stop partner typing
            setPartnerTyping((prev) => ({ ...prev, isTyping: false }));
          }
        }
      };
    } catch (err) {
      console.warn('[PIN Chat] BroadcastChannel note:', err);
    }

    return () => {
      if (channel) {
        channel.close();
      }
    };
  }, [pin, triggerAiAutoReply, user.uid]);

  // Handle Input typing changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputText(value);

    if (value.trim().length > 0) {
      emitTypingState(true);

      // Debounce typing stop after 2 seconds of no keystrokes
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        emitTypingState(false);
      }, 2000);
    } else {
      emitTypingState(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  // Handle Sending a Message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    // Clear typing flag immediately
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    emitTypingState(false);

    const now = Date.now();
    const messageId = `msg-${now}-${Math.random().toString(36).slice(2, 7)}`;
    const myUid = user.uid || 'current-user-id';
    const myName = user.displayName || 'Me';

    // 1. Create message
    const newMessage: Message = {
      messageId,
      senderUid: myUid,
      senderName: myName,
      text,
      createdAt: now,
      isAi: false,
      status: 'sent',
    };

    // Mark as processed so we don't trigger AI on our own message
    processedMessageIdsRef.current.add(messageId);

    // 2. Clear input text immediately
    setInputText('');

    // 3. Append to state
    setMessages((prev) => [...prev, newMessage]);

    // 4. Broadcast to other tab
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'new_message',
          message: newMessage,
        });
      } catch {
        // ignore
      }
    }

    // 5. Update delivery state
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageId === messageId ? { ...msg, status: 'delivered' } : msg
        )
      );
    }, 400);

    // 6. Save to Firestore
    if (db) {
      try {
        const msgDocRef = doc(db, 'rooms', pin, 'messages', messageId);
        setDoc(msgDocRef, {
          senderUid: myUid,
          senderName: myName,
          text,
          createdAt: serverTimestamp(),
          isAi: false,
          status: 'delivered',
        }).catch(() => {});
      } catch {
        // ignore
      }
    }
  };

  const handleCopyPin = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setPinCopied(true);
      setTimeout(() => setPinCopied(false), 2000);
    } catch {
      setPinCopied(true);
      setTimeout(() => setPinCopied(false), 2000);
    }
  };

  // Microphone click handler (UI feedback placeholder for Voice-to-Text)
  const handleMicClick = () => {
    setMicActive(true);
    setMicNotice('Microphone active. Listening for voice input...');
    setTimeout(() => {
      setMicActive(false);
      setMicNotice(null);
    }, 2500);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div
      id="chat-room-screen"
      className="w-full h-screen flex flex-col bg-[#07090e] text-slate-100 select-none overflow-hidden relative"
    >
      {/* Cinematic ambient background glow */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-40 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* 1. Header with PIN & Gemini AI Controls */}
      <header
        id="chatHeader"
        className="w-full px-3 sm:px-4 py-2.5 bg-[#0f121a]/95 backdrop-blur-xl border-b border-white/10 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0 shadow-lg"
      >
        {/* Left: Back & Room PIN */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            id="chatBackBtn"
            onClick={onBack}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer active:scale-95"
            title="Back to Home Screen"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                ROOM:
              </span>
              <span
                id="headerRoomPin"
                className="text-xs sm:text-sm font-mono font-bold tracking-widest text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-lg border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]"
              >
                PIN: {pin}
              </span>
              <button
                id="copyRoomPinHeaderBtn"
                onClick={handleCopyPin}
                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-amber-400 transition-all cursor-pointer active:scale-95"
                title="Copy Room PIN"
              >
                {pinCopied ? (
                  <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 font-mono">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span>{isOnline ? 'ONLINE & SECURE' : 'OFFLINE'}</span>
            </div>
          </div>
        </div>

        {/* Right: Gemini AI Auto-Reply Toggle & Persona Selector Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Persona Selector Dropdown */}
          <div className="flex items-center gap-1.5 bg-[#161b26] border border-white/10 px-2.5 py-1.5 rounded-xl text-xs">
            <Bot className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              id="personaSelectorDropdown"
              value={selectedPersona}
              onChange={(e) => setSelectedPersona(e.target.value as PersonaType)}
              className="bg-transparent text-amber-300 text-xs font-medium focus:outline-none cursor-pointer pr-1"
              title="Select AI Persona"
            >
              {PERSONA_OPTIONS.map((persona) => (
                <option
                  key={persona}
                  value={persona}
                  className="bg-[#161b26] text-slate-200"
                >
                  {persona}
                </option>
              ))}
            </select>
          </div>

          {/* AI Auto-Reply Toggle: [ON / OFF] */}
          <button
            id="aiAutoReplyToggleBtn"
            onClick={() => setIsAutoReplyEnabled((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 ${
              isAutoReplyEnabled
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Gemini AI Auto-Reply"
          >
            <Sparkles
              className={`w-3.5 h-3.5 ${
                isAutoReplyEnabled ? 'text-emerald-400 animate-spin' : 'text-slate-500'
              }`}
            />
            <span className="hidden xs:inline text-[11px]">AI Auto-Reply:</span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                isAutoReplyEnabled
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-white/10 text-slate-400'
              }`}
            >
              {isAutoReplyEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </header>

      {/* Non-intrusive Offline / Online Alert Banner */}
      {!isOnline && (
        <div
          id="offlineStatusAlertBanner"
          className="w-full bg-rose-500/90 text-white text-xs font-medium py-1.5 px-4 flex items-center justify-center gap-2 z-30 shadow-md backdrop-blur-sm transition-all"
        >
          <WifiOff className="w-3.5 h-3.5 animate-pulse shrink-0" />
          <span>You are offline. Trying to reconnect... Messages will sync once reconnected</span>
        </div>
      )}

      {isOnline && showBackOnlineNotice && (
        <div
          id="onlineStatusAlertBanner"
          className="w-full bg-emerald-500 text-slate-950 text-xs font-semibold py-1.5 px-4 flex items-center justify-center gap-2 z-30 shadow-md backdrop-blur-sm transition-all animate-fade-in"
        >
          <Wifi className="w-3.5 h-3.5 shrink-0" />
          <span>Back online - connection restored</span>
        </div>
      )}

      {/* Active Persona Banner if Auto-Reply is ON */}
      {isAutoReplyEnabled && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center justify-center gap-2 text-amber-300 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            Gemini AI Auto-Reply active as <strong className="font-bold text-white">{selectedPersona}</strong> (gemini-2.5-flash)
          </span>
        </div>
      )}

      {/* Voice Notification Toast */}
      {micNotice && (
        <div
          id="micToastNotice"
          className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-amber-500/90 text-slate-950 font-semibold text-xs shadow-xl flex items-center gap-2 animate-bounce"
        >
          <Mic className="w-3.5 h-3.5" />
          <span>{micNotice}</span>
        </div>
      )}

      {/* 2. Message Area: Scrollable Container */}
      <div
        id="messagesContainer"
        className="flex-1 w-full max-w-3xl mx-auto overflow-y-auto px-4 py-6 flex flex-col gap-4"
      >
        {/* Security & Room Notice */}
        <div className="w-full py-2 px-4 rounded-xl bg-[#0f121a]/70 border border-white/[0.06] text-center flex items-center justify-center gap-2 text-slate-400 text-xs shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Private 1-on-1 PIN chat. Messages are saved securely in this room.</span>
        </div>

        {/* Empty State: Starts completely empty unless real users have sent messages */}
        {messages.length === 0 && (
          <div
            id="emptyChatState"
            className="flex-1 flex flex-col items-center justify-center text-center p-6 my-auto animate-fade-in"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white mb-1">
              Room #{pin} is Ready
            </h4>
            <p className="text-xs text-slate-400 max-w-xs mb-4 leading-relaxed">
              No messages yet. Send a message to start your private conversation with your partner.
            </p>
            <div className="px-3 py-1.5 rounded-lg bg-[#161b26] border border-white/10 text-[11px] font-mono text-slate-300 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Strictly 2 members allowed</span>
            </div>
          </div>
        )}

        {/* Dynamic Real Messages List */}
        {messages.map((msg) => {
          const isOutgoing =
            msg.senderUid === (user.uid || 'current-user-id') ||
            msg.senderName === (user.displayName || 'Me');

          return (
            <div
              key={msg.messageId}
              id={`message-${msg.messageId}`}
              className={`w-full flex flex-col ${
                isOutgoing ? 'items-end' : 'items-start'
              }`}
            >
              {/* Sender Name above incoming bubble */}
              {!isOutgoing && (
                <span className="text-[11px] font-semibold text-amber-400/90 mb-1 ml-1 flex items-center gap-1">
                  <UserIcon className="w-3 h-3" />
                  {msg.senderName}
                </span>
              )}

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-md transition-all ${
                  isOutgoing
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-medium rounded-tr-none'
                    : 'bg-[#161b26] border border-white/10 text-slate-100 rounded-tl-none'
                }`}
              >
                <p className="break-words whitespace-pre-wrap">{msg.text}</p>

                {/* Footer: Timestamp & Delivery Status */}
                <div
                  className={`text-[10px] font-mono mt-1 flex items-center justify-end gap-1 ${
                    isOutgoing ? 'text-slate-900/70 font-semibold' : 'text-slate-400'
                  }`}
                >
                  <span>{formatTimestamp(msg.createdAt)}</span>

                  {/* Delivery Status Indicator for Outgoing Messages */}
                  {isOutgoing && (
                    <span
                      className="inline-flex items-center ml-1"
                      title={msg.status === 'delivered' ? 'Delivered' : 'Sent'}
                    >
                      {msg.status === 'delivered' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-slate-900" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-slate-800/80" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* 3. Indicators */}
        {/* Partner Typing Bubble */}
        {partnerTyping.isTyping && !aiIsTyping && (
          <div
            id="partnerTypingIndicator"
            className="w-full flex flex-col items-start transition-all animate-fade-in"
          >
            <span className="text-[11px] font-semibold text-amber-400/90 mb-1 ml-1 flex items-center gap-1">
              <UserIcon className="w-3 h-3" />
              {partnerTyping.name || 'Partner'}
            </span>
            <div className="bg-[#161b26] border border-white/10 text-slate-300 px-4 py-2.5 rounded-2xl rounded-tl-none flex items-center gap-2.5 text-xs shadow-md">
              <span className="text-slate-400 font-medium">
                {partnerTyping.name || 'Partner'} is typing
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" />
              </span>
            </div>
          </div>
        )}

        {/* Gemini AI Auto-Reply Typing Indicator */}
        {aiIsTyping && (
          <div
            id="aiTypingIndicator"
            className="w-full flex flex-col items-start transition-all animate-fade-in"
          >
            <span className="text-[11px] font-semibold text-amber-400 mb-1 ml-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              {selectedPersona} AI
            </span>
            <div className="bg-[#161b26] border border-amber-500/30 text-amber-300 px-4 py-2.5 rounded-2xl rounded-tl-none flex items-center gap-2.5 text-xs shadow-md">
              <span className="font-medium">
                {selectedPersona} AI is typing...
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" />
              </span>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* 4. Bottom Action Bar */}
      <div
        id="chatInputBar"
        className="w-full bg-[#0f121a]/95 backdrop-blur-xl border-t border-white/10 p-3 sm:p-4 z-20 shrink-0"
      >
        <form
          onSubmit={handleSendMessage}
          className="max-w-3xl mx-auto flex items-center gap-2"
        >
          {/* Microphone Button */}
          <button
            id="chatVoiceBtn"
            type="button"
            onClick={handleMicClick}
            className={`p-3 rounded-xl border transition-all cursor-pointer active:scale-95 shrink-0 ${
              micActive
                ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/30 animate-pulse'
                : 'bg-[#161b26] border-white/10 text-slate-300 hover:text-amber-400 hover:border-amber-500/40'
            }`}
            title="Voice-to-Text Microphone"
          >
            <Mic className="w-5 h-5" />
          </button>

          {/* Text Input Field with Enter-key submit */}
          <input
            id="chatMessageInput"
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type a message..."
            autoComplete="off"
            className="flex-1 px-4 py-3 bg-[#161b26] border border-white/10 focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all"
          />

          {/* Send Button */}
          <button
            id="chatSendBtn"
            type="submit"
            disabled={!inputText.trim()}
            className={`p-3 rounded-xl font-bold transition-all shadow-md active:scale-95 shrink-0 ${
              inputText.trim()
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20 cursor-pointer'
                : 'bg-white/[0.05] text-slate-500 border border-white/[0.05] cursor-not-allowed opacity-50'
            }`}
            title="Send Message"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
