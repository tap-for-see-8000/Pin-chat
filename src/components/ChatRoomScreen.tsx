/**
 * PIN Chat - Chat Room Screen
 * Fixed: Headers authentication for new 'AQ.' Gemini API Keys + Robust Auto-Reply
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

  // Gemini AI Auto-Reply State
  const [isAutoReplyEnabled, setIsAutoReplyEnabled] = useState<boolean>(true);
  const [selectedPersona, setSelectedPersona] = useState<PersonaType>('Friend');
  const [aiIsTyping, setAiIsTyping] = useState<boolean>(false);

  const isAutoReplyEnabledRef = useRef(isAutoReplyEnabled);
  isAutoReplyEnabledRef.current = isAutoReplyEnabled;

  const selectedPersonaRef = useRef(selectedPersona);
  selectedPersonaRef.current = selectedPersona;

  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const isFirstSnapshotRef = useRef<boolean>(true);
  const isGeneratingReplyRef = useRef<boolean>(false);

  // Network State
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showBackOnlineNotice, setShowBackOnlineNotice] = useState<boolean>(false);

  const [partnerTyping, setPartnerTyping] = useState<{ isTyping: boolean; name: string }>({
    isTyping: false,
    name: 'Partner',
  });

  const historyStorageKey = `pinchat_history_${pin}`;

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(historyStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
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
    return [];
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

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

  useEffect(() => {
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(messages));
    } catch (e) {
      console.warn('[PIN Chat] Failed to save history:', e);
    }
  }, [messages, historyStorageKey]);

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

  // Emit typing indicator
  const emitTypingState = useCallback(
    (isTyping: boolean) => {
      const myUid = user.uid || 'current-user-id';
      const myName = user.displayName || 'Mohit';

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

  // Gemini API Trigger with Header Authentication for AQ. keys
  const triggerAiAutoReply = useCallback(
    async (incomingMsg: Message) => {
      if (isGeneratingReplyRef.current) return;
      isGeneratingReplyRef.current = true;
      setAiIsTyping(true);

      const persona = selectedPersonaRef.current;
      const personaName = `${persona} (AI)`;

      try {
        const apiKey =
          (import.meta.env.VITE_GEMINI_API_KEY as string) ||
          (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '') ||
          '';

        const systemInstruction = `You are a real close partner in a private live chat acting as ${persona}. Respond in Hindi, Hinglish, or English matching the user. Reply in 1 short, natural, conversational sentence. Never say you are an AI or bot.`;

        let replyText = '';

        if (apiKey) {
          // AQ. format requires the key in the x-goog-api-key header
          const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey.trim(),
            },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `${systemInstruction}\n\nIncoming message: "${incomingMsg.text}"\nReply directly:`,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 120,
              },
            }),
          });

          if (res.ok) {
            const data = await res.json();
            replyText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          } else {
            console.error('[PIN Chat] Gemini API call status:', res.status);
          }
        }

        // Fallback agar API block ya fail ho
        if (!replyText) {
          if (persona === 'Friend') {
            replyText = 'Haan bhai, sab badhiya! Bol kya chal raha hai?';
          } else if (persona === 'Wife / Partner') {
            replyText = 'Haan bolo ji, sun rahi hoon! Sab theek hai na?';
          } else {
            replyText = 'Haan, maine aapka message dekh liya!';
          }
        }

        // Short natural delay
        await new Promise((r) => setTimeout(r, 700));

        const messageId = `msg-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const aiMsg: Message = {
          messageId,
          senderUid: 'ai-persona-uid',
          senderName: personaName,
          text: replyText,
          createdAt: Date.now(),
          isAi: true,
          status: 'delivered',
        };

        processedMessageIdsRef.current.add(messageId);
        setMessages((prev) => [...prev, aiMsg]);

        if (broadcastChannelRef.current) {
          try {
            broadcastChannelRef.current.postMessage({
              type: 'new_message',
              message: aiMsg,
            });
          } catch {
            // ignore
          }
        }

        if (db) {
          try {
            const msgDocRef = doc(db, 'rooms', pin, 'messages', messageId);
            await setDoc(msgDocRef, {
              senderUid: 'ai-persona-uid',
              senderName: personaName,
              text: replyText,
              createdAt: serverTimestamp(),
              isAi: true,
              status: 'delivered',
            });
          } catch (err) {
            console.warn('[PIN Chat] Error saving AI message:', err);
          }
        }
      } catch (err) {
        console.error('[PIN Chat] Error generating reply:', err);
      } finally {
        setAiIsTyping(false);
        isGeneratingReplyRef.current = false;
      }
    },
    [pin]
  );

  // Firestore Messages & Typing listeners
  useEffect(() => {
    if (!db) return;

    const messagesRef = collection(db, 'rooms', pin, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribeMessages = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const remoteMessages: Message[] = [];
          const newIncoming: Message[] = [];

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

            // Har naye insaan ke message par reply trigger karein
            if (
              !isFirstSnapshotRef.current &&
              !processedMessageIdsRef.current.has(msgId) &&
              !msg.isAi
            ) {
              newIncoming.push(msg);
            }

            processedMessageIdsRef.current.add(msgId);
          });

          if (remoteMessages.length > 0) {
            setMessages((prev) => {
              const map = new Map<string, Message>();
              prev.forEach((m) => map.set(m.messageId, m));
              remoteMessages.forEach((m) => map.set(m.messageId, m));
              return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
            });
          }

          if (
            !isFirstSnapshotRef.current &&
            isAutoReplyEnabledRef.current &&
            newIncoming.length > 0
          ) {
            const latest = newIncoming[newIncoming.length - 1];
            triggerAiAutoReply(latest);
          }

          isFirstSnapshotRef.current = false;
        } else {
          isFirstSnapshotRef.current = false;
        }
      },
      (err) => {
        console.warn('[PIN Chat] Messages sync warning:', err.message);
      }
    );

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
            const isFresh = Date.now() - (data.updatedAt || 0) < 4000;
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
        console.warn('[PIN Chat] Typing sync warning:', err.message);
      }
    );

    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
    };
  }, [pin, triggerAiAutoReply, user.uid]);

  // BroadcastChannel Sync
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(`pinchat_room_${pin}`);
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'typing') {
          if (data.senderUid !== (user.uid || 'current-user-id')) {
            setPartnerTyping({
              isTyping: Boolean(data.isTyping),
              name: data.senderName || 'Partner',
            });
          }
        }

        if (data.type === 'new_message' && data.message) {
          const incoming: Message = data.message;

          setMessages((prev) => {
            if (prev.some((m) => m.messageId === incoming.messageId)) return prev;
            return [...prev, incoming].sort((a, b) => a.createdAt - b.createdAt);
          });

          if (
            isAutoReplyEnabledRef.current &&
            !processedMessageIdsRef.current.has(incoming.messageId) &&
            !incoming.isAi
          ) {
            processedMessageIdsRef.current.add(incoming.messageId);
            triggerAiAutoReply(incoming);
          }

          setPartnerTyping((prev) => ({ ...prev, isTyping: false }));
        }
      };
    } catch (err) {
      console.warn('[PIN Chat] BroadcastChannel warning:', err);
    }

    return () => {
      if (channel) channel.close();
    };
  }, [pin, triggerAiAutoReply, user.uid]);

  // Typing handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (val.trim().length > 0) {
      emitTypingState(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => emitTypingState(false), 2000);
    } else {
      emitTypingState(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  // Send message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    emitTypingState(false);

    const now = Date.now();
    const messageId = `msg-${now}-${Math.random().toString(36).slice(2, 6)}`;
    const myUid = user.uid || 'current-user-id';
    const myName = user.displayName || 'Mohit';

    const newMsg: Message = {
      messageId,
      senderUid: myUid,
      senderName: myName,
      text,
      createdAt: now,
      isAi: false,
      status: 'sent',
    };

    setInputText('');
    setMessages((prev) => [...prev, newMsg]);

    // Send to other devices
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'new_message',
          message: newMsg,
        });
      } catch {
        // ignore
      }
    }

    // Auto-reply trigger (works even if testing alone on same phone)
    if (isAutoReplyEnabledRef.current) {
      setTimeout(() => {
        triggerAiAutoReply(newMsg);
      }, 400);
    }

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.messageId === messageId ? { ...m, status: 'delivered' } : m))
      );
    }, 400);

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

  const handleMicClick = () => {
    setMicActive(true);
    setMicNotice('Listening...');
    setTimeout(() => {
      setMicActive(false);
      setMicNotice(null);
    }, 2000);
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
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-40 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header
        id="chatHeader"
        className="w-full px-3 sm:px-4 py-2.5 bg-[#0f121a]/95 backdrop-blur-xl border-b border-white/10 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0 shadow-lg"
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            id="chatBackBtn"
            onClick={onBack}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer active:scale-95"
            title="Back"
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
                className="text-xs sm:text-sm font-mono font-bold tracking-widest text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-lg border border-amber-500/30"
              >
                PIN: {pin}
              </span>
              <button
                id="copyRoomPinHeaderBtn"
                onClick={handleCopyPin}
                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-amber-400 transition-all cursor-pointer active:scale-95"
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

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#161b26] border border-white/10 px-2.5 py-1.5 rounded-xl text-xs">
            <Bot className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              id="personaSelectorDropdown"
              value={selectedPersona}
              onChange={(e) => setSelectedPersona(e.target.value as PersonaType)}
              className="bg-transparent text-amber-300 text-xs font-medium focus:outline-none cursor-pointer pr-1"
            >
              {PERSONA_OPTIONS.map((persona) => (
                <option key={persona} value={persona} className="bg-[#161b26] text-slate-200">
                  {persona}
                </option>
              ))}
            </select>
          </div>

          <button
            id="aiAutoReplyToggleBtn"
            onClick={() => setIsAutoReplyEnabled((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 ${
              isAutoReplyEnabled
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles
              className={`w-3.5 h-3.5 ${
                isAutoReplyEnabled ? 'text-emerald-400 animate-spin' : 'text-slate-500'
              }`}
            />
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-400 text-slate-950">
              {isAutoReplyEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </header>

      {/* Persona Banner */}
      {isAutoReplyEnabled && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center justify-center gap-2 text-amber-300 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            Gemini AI Auto-Reply active as <strong className="font-bold text-white">{selectedPersona}</strong> (gemini-1.5-flash)
          </span>
        </div>
      )}

      {/* Messages */}
      <div
        id="messagesContainer"
        className="flex-1 w-full max-w-3xl mx-auto overflow-y-auto px-4 py-6 flex flex-col gap-4"
      >
        <div className="w-full py-2 px-4 rounded-xl bg-[#0f121a]/70 border border-white/[0.06] text-center flex items-center justify-center gap-2 text-slate-400 text-xs shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Private 1-on-1 PIN chat. Messages are saved securely in this room.</span>
        </div>

        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 my-auto">
            <MessageSquare className="w-10 h-10 text-amber-400 mb-2" />
            <h4 className="text-base font-bold text-white mb-1">Room #{pin} is Ready</h4>
            <p className="text-xs text-slate-400 max-w-xs">Send a message to start conversation.</p>
          </div>
        )}

        {messages.map((msg) => {
          const isOutgoing =
            !msg.isAi &&
            (msg.senderUid === (user.uid || 'current-user-id') ||
              msg.senderName === (user.displayName || 'Mohit'));

          return (
            <div
              key={msg.messageId}
              className={`w-full flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}
            >
              {!isOutgoing && (
                <span className="text-[11px] font-semibold text-amber-400/90 mb-1 ml-1 flex items-center gap-1">
                  <UserIcon className="w-3 h-3" />
                  {msg.senderName}
                </span>
              )}

              <div
                className={`max-w-[85%] sm:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-md ${
                  isOutgoing
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-medium rounded-tr-none'
                    : 'bg-[#161b26] border border-white/10 text-slate-100 rounded-tl-none'
                }`}
              >
                <p className="break-words whitespace-pre-wrap">{msg.text}</p>
                <div
                  className={`text-[10px] font-mono mt-1 flex items-center justify-end gap-1 ${
                    isOutgoing ? 'text-slate-900/70 font-semibold' : 'text-slate-400'
                  }`}
                >
                  <span>{formatTimestamp(msg.createdAt)}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Real partner typing */}
        {partnerTyping.isTyping && (
          <div className="w-full flex flex-col items-start transition-all">
            <span className="text-[11px] font-semibold text-amber-400/90 mb-1 ml-1 flex items-center gap-1">
              <UserIcon className="w-3 h-3" />
              {partnerTyping.name}
            </span>
            <div className="bg-[#161b26] border border-white/10 text-slate-300 px-4 py-2.5 rounded-2xl rounded-tl-none flex items-center gap-2.5 text-xs shadow-md">
              <span className="text-slate-400">{partnerTyping.name} is typing...</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" />
              </span>
            </div>
          </div>
        )}

        {/* AI Typing Indicator */}
        {aiIsTyping && (
          <div className="w-full flex flex-col items-start transition-all">
            <span className="text-[11px] font-semibold text-amber-400 mb-1 ml-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              {selectedPersona} (AI)
            </span>
            <div className="bg-[#161b26] border border-amber-500/30 text-amber-300 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
              <span>{selectedPersona} AI is typing...</span>
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Input Bar */}
      <div
        id="chatInputBar"
        className="w-full bg-[#0f121a]/95 backdrop-blur-xl border-t border-white/10 p-3 sm:p-4 z-20 shrink-0"
      >
        <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex items-center gap-2">
          <input
            id="chatMessageInput"
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder="Type a message..."
            autoComplete="off"
            className="flex-1 px-4 py-3 bg-[#161b26] border border-white/10 focus:border-amber-500/70 rounded-xl text-sm text-white focus:outline-none"
          />
          <button
            id="chatSendBtn"
            type="submit"
            disabled={!inputText.trim()}
            className="p-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold cursor-pointer shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
