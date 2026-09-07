/**
 * PIN Chat - Direct 1-on-1 Chat Room Screen
 * Package: com.aistudio.pinchat.kpmd
 * 
 * Comprehensive Features:
 * 1. Real-Time Partner Presence:
 *    - Firestore `users/{username}/presence` tracking
 *    - Header shows: "Online" + pulsating green dot OR "Last seen [X] mins ago"
 * 2. Chat Bubbles & Sender Recognition:
 *    - Outgoing (logged-in user): Strictly aligned RIGHT (amber/orange gradient bubble)
 *    - Incoming (partner): Strictly aligned LEFT (dark slate bubble)
 *    - Outgoing delivery status:
 *      * Single tick (✓): Sent
 *      * Double tick (✓✓) + small RED dot (🔴): Delivered (unread)
 *      * Double tick (✓✓) + small GREEN dot (🟢): Seen / Read by partner
 *    - Auto-marks incoming messages as 'seen' when viewed
 * 3. Message Controls:
 *    - 3-dot / Action menu on message:
 *      * UNSEND FOR EVERYONE: Available ONLY within 120 seconds (2 minutes); removes from Firestore for both users
 *      * DELETE PERMANENTLY: Always available; deletes locally & from Firestore
 * 4. Stealth Gemini AI Auto-Reply:
 *    - Triggers ONLY on incoming messages from partner (left-aligned)
 *    - NEVER triggers on user's own messages (right-aligned)
 *    - Sends under user's authentic name/bubble with NO 'AI' or 'Bot' labels
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
  Bot,
  ChevronDown,
  MoreVertical,
  Trash2,
  RotateCcw,
  Copy,
  X,
  Clock,
  Radio,
  Compass,
} from 'lucide-react';
import {
  UserRecord,
  PublicUserProfile,
  ChatMessage,
  PersonaType,
  UserPresence,
  LocationSession,
} from '../types';
import {
  saveConversationItem,
  subscribeToUserPresence,
  updateUserPresence,
  formatLastSeen,
  unsendFirestoreMessage,
  deleteFirestoreMessage,
  requestLocationSharing,
  respondLocationSharing,
  stopLocationSharing,
} from '../userService';
import { LiveLocationRadar } from './LiveLocationRadar';
import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { CyberpunkAnimeEye } from './CyberpunkAnimeEye';
import {
  enqueueIncomingMessageForAutoReply,
  getChatAutoReplySettings,
  saveChatAutoReplySettings,
} from '../services/aiAutoReplyEngine';
import { AutoReplyStyle } from '../types';

interface ChatRoomScreenProps {
  chatId: string;
  currentUser: UserRecord;
  targetUser: PublicUserProfile;
  onBack: () => void;
}

const STYLE_OPTIONS: { id: AutoReplyStyle; label: string }[] = [
  { id: 'friend', label: 'Friend' },
  { id: 'casual', label: 'Casual' },
  { id: 'supportive', label: 'Supportive' },
  { id: 'professional', label: 'Professional' },
];

export const ChatRoomScreen: React.FC<ChatRoomScreenProps> = ({
  chatId,
  currentUser,
  targetUser,
  onBack,
}) => {
  const [inputText, setInputText] = useState('');
  const [micActive, setMicActive] = useState(false);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Stealth Gemini AI Auto-Reply State (Default ON, with selected Conversation Style)
  const initialSettings = getChatAutoReplySettings(chatId, currentUser.username);
  const [isAutoReplyEnabled, setIsAutoReplyEnabled] = useState<boolean>(initialSettings.enabled);
  const [autoReplyStyle, setAutoReplyStyle] = useState<AutoReplyStyle>(initialSettings.style);

  // Real-Time Partner Presence State
  const [partnerPresence, setPartnerPresence] = useState<UserPresence>({
    isOnline: false,
    lastSeen: Date.now(),
  });

  // Action Menu State on individual messages
  const [selectedMessageForAction, setSelectedMessageForAction] = useState<ChatMessage | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Synchronized refs for listeners
  const isAutoReplyEnabledRef = useRef(isAutoReplyEnabled);
  isAutoReplyEnabledRef.current = isAutoReplyEnabled;

  const autoReplyStyleRef = useRef(autoReplyStyle);
  autoReplyStyleRef.current = autoReplyStyle;

  // Track processed messages to prevent duplicate AI triggers
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const isFirstSnapshotRef = useRef<boolean>(true);

  // Network Online/Offline state
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Partner typing indicator
  const [partnerTyping, setPartnerTyping] = useState<{ isTyping: boolean; name: string }>({
    isTyping: false,
    name: targetUser.fullName || targetUser.username,
  });

  // Storage key for persistent chat history
  const historyStorageKey = `pinchat_messages_${chatId}`;

  // Initial messages loader
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(historyStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (m) =>
              m &&
              typeof m.text === 'string' &&
              m.text.trim().length > 0 &&
              !m.deletedForEveryone
          );
          return valid.sort((a, b) => a.createdAt - b.createdAt);
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Auto-scroll smoothly to latest message
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
  }, [messages, partnerTyping.isTyping, scrollToBottom]);

  // Persist messages locally
  useEffect(() => {
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, historyStorageKey]);

  // 1. Subscribe to Real-Time Partner Presence
  useEffect(() => {
    const unsubscribePresence = subscribeToUserPresence(targetUser.username, (presence) => {
      setPartnerPresence(presence);
    });

    return () => {
      unsubscribePresence();
    };
  }, [targetUser.username]);

  // 2. Maintain Logged-In User Presence Heartbeat & Event Listeners
  useEffect(() => {
    updateUserPresence(currentUser.username, true);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updateUserPresence(currentUser.username, true);
      }
    }, 25000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateUserPresence(currentUser.username, true);
      } else {
        updateUserPresence(currentUser.username, false);
      }
    };

    const handleUnload = () => {
      updateUserPresence(currentUser.username, false);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [currentUser.username]);

  // 2b. Firestore Real-Time Listener for Mutual Location Session
  const [locationSession, setLocationSession] = useState<LocationSession | undefined>(undefined);

  useEffect(() => {
    if (!db) return;
    try {
      const chatRef = doc(db, 'chats', chatId);
      const unsub = onSnapshot(chatRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.locationSession) {
            setLocationSession(data.locationSession as LocationSession);
          } else {
            setLocationSession({ status: 'idle', requestedBy: '', activeUsers: {} });
          }
        }
      });
      return () => unsub();
    } catch (err) {
      console.warn('[ChatRoom] location session snapshot note:', err);
    }
  }, [chatId]);

  // Helper toast notifier
  const showToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => {
      setToastNotice(null);
    }, 2500);
  };

  const handleToggleLocationRadar = () => {
    if (!locationSession || locationSession.status === 'idle') {
      requestLocationSharing(chatId, currentUser.username);
      showToast('Location radar requested');
    } else if (locationSession.status === 'requested') {
      if (locationSession.requestedBy === currentUser.username.toLowerCase()) {
        stopLocationSharing(chatId);
        showToast('Location request cancelled');
      } else {
        respondLocationSharing(chatId, true, currentUser.username);
        showToast('Location radar accepted');
      }
    } else if (locationSession.status === 'active') {
      stopLocationSharing(chatId);
      showToast('Live location radar stopped');
    }
  };

  // Header Auto-Reply Toggle & Style change handlers
  const handleToggleAutoReply = () => {
    setIsAutoReplyEnabled((prev) => {
      const next = !prev;
      saveChatAutoReplySettings(chatId, currentUser.username, next, autoReplyStyle);
      showToast(`Auto-Reply: ${next ? 'ON' : 'OFF'}`);
      return next;
    });
  };

  const handleChangeStyle = (newStyle: AutoReplyStyle) => {
    setAutoReplyStyle(newStyle);
    saveChatAutoReplySettings(chatId, currentUser.username, isAutoReplyEnabled, newStyle);
    showToast(`Style set to ${newStyle.charAt(0).toUpperCase() + newStyle.slice(1)}`);
  };

  // 3. Dispatch Auto-Reply Pipeline via Stealth Engine
  const dispatchAutoReplyForIncomingMessage = useCallback(
    (incomingMsg: ChatMessage) => {
      if (!isAutoReplyEnabledRef.current) return;

      enqueueIncomingMessageForAutoReply({
        message: incomingMsg,
        chatId,
        currentUsername: currentUser.username,
        currentFullName: currentUser.fullName,
        targetUser,
        settings: {
          enabled: isAutoReplyEnabledRef.current,
          style: autoReplyStyleRef.current,
        },
        onMessageCommitted: (newMsg) => {
          setMessages((prev) => {
            if (prev.some((m) => m.messageId === newMsg.messageId)) return prev;
            return [...prev, newMsg].sort((a, b) => a.createdAt - b.createdAt);
          });
        },
        onTargetStatusUpdated: (targetId, status) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.messageId === targetId ? { ...m, aiProcessingStatus: status } : m
            )
          );
        },
      });
    },
    [chatId, currentUser.fullName, currentUser.username, targetUser]
  );

  // 4. Setup BroadcastChannel for Instant Cross-Tab Sync & Real-Time Typing
  useEffect(() => {
    const channelName = `pinchat_channel_${chatId}`;
    let channel: BroadcastChannel | null = null;

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(channelName);
        broadcastChannelRef.current = channel;

        channel.onmessage = (event) => {
          const data = event.data;
          if (!data) return;

          if (data.type === 'new_message' && data.message) {
            const incoming: ChatMessage = data.message;
            if (incoming.chatId === chatId) {
              setMessages((prev) => {
                if (prev.some((m) => m.messageId === incoming.messageId)) return prev;
                return [...prev, incoming].sort((a, b) => a.createdAt - b.createdAt);
              });
              saveConversationItem(currentUser.username, targetUser, incoming.text, incoming.createdAt);

              // Auto-reply pipeline check for rapid incoming cross-tab messages
              if (
                incoming.senderUsername.toLowerCase() !== currentUser.username.toLowerCase() &&
                isAutoReplyEnabledRef.current &&
                !processedMessageIdsRef.current.has(incoming.messageId)
              ) {
                processedMessageIdsRef.current.add(incoming.messageId);
                dispatchAutoReplyForIncomingMessage(incoming);
              }
            }
          } else if (data.type === 'typing_status') {
            if (data.username !== currentUser.username.toLowerCase()) {
              setPartnerTyping({
                isTyping: Boolean(data.isTyping),
                name: data.senderName || targetUser.fullName,
              });
            }
          } else if (data.type === 'messages_seen') {
            // Partner saw our messages
            setMessages((prev) =>
              prev.map((m) =>
                m.senderUsername.toLowerCase() === currentUser.username.toLowerCase()
                  ? { ...m, status: 'seen', seenAt: Date.now() }
                  : m
              )
            );
          } else if (data.type === 'unsend_message' || data.type === 'delete_message') {
            if (data.messageId) {
              setMessages((prev) => prev.filter((m) => m.messageId !== data.messageId));
            }
          }
        };
      }
    } catch {
      // ignore
    }

    return () => {
      if (channel) channel.close();
      broadcastChannelRef.current = null;
    };
  }, [chatId, currentUser.username, dispatchAutoReplyForIncomingMessage, targetUser]);

  // 5. Emit Current User Typing State
  const emitTypingState = useCallback(
    (isTyping: boolean, senderName = currentUser.fullName) => {
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: 'typing_status',
            username: currentUser.username.toLowerCase(),
            senderName,
            isTyping,
          });
        } catch {
          // ignore
        }
      }

      if (db) {
        try {
          const typingDocRef = doc(db, 'chats', chatId, 'typing', currentUser.username.toLowerCase());
          setDoc(
            typingDocRef,
            {
              isTyping,
              username: currentUser.username.toLowerCase(),
              senderName,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          ).catch(() => {});
        } catch {
          // ignore
        }
      }
    },
    [chatId, currentUser.fullName, currentUser.username]
  );

  // 6. Real-Time Firestore Typing Listener for Partner
  useEffect(() => {
    if (!db) return;
    try {
      const partnerClean = targetUser.username.trim().toLowerCase();
      const typingDocRef = doc(db, 'chats', chatId, 'typing', partnerClean);
      const unsub = onSnapshot(typingDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const isTyping = Boolean(data.isTyping);
          setPartnerTyping({
            isTyping,
            name: data.senderName || targetUser.fullName || targetUser.username,
          });
        }
      });
      return () => unsub();
    } catch {
      // ignore
    }
  }, [chatId, targetUser.fullName, targetUser.username]);

  // 6. Firestore Real-Time Listener for Messages & Marking Incoming Messages as Seen
  useEffect(() => {
    if (!db) return;

    try {
      const messagesColl = collection(db, 'chats', chatId, 'messages');
      const q = query(messagesColl, orderBy('createdAt', 'asc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (snapshot.empty) {
            isFirstSnapshotRef.current = false;
            return;
          }

          const remoteMsgs: ChatMessage[] = [];
          const unreadPartnerMsgIds: string[] = [];

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const createdAtMillis = data.createdAt?.toMillis
              ? data.createdAt.toMillis()
              : typeof data.createdAt === 'number'
              ? data.createdAt
              : Date.now();

            const msg: ChatMessage = {
              messageId: docSnap.id,
              chatId: data.chatId || chatId,
              senderUsername: data.senderUsername || '',
              senderName: data.senderName || '',
              text: data.text || '',
              createdAt: createdAtMillis,
              isAi: data.isAi,
              status: data.status || 'delivered',
              seenAt: data.seenAt,
              deletedForEveryone: data.deletedForEveryone,
            };

            if (!msg.deletedForEveryone) {
              remoteMsgs.push(msg);

              // If partner sent this message and it's not marked seen yet, prepare to mark seen
              if (
                msg.senderUsername.toLowerCase() !== currentUser.username.toLowerCase() &&
                msg.status !== 'seen'
              ) {
                unreadPartnerMsgIds.push(msg.messageId);
              }
            }
          });

          // Mark incoming unread partner messages as 'seen' in Firestore
          if (unreadPartnerMsgIds.length > 0) {
            unreadPartnerMsgIds.forEach((mId) => {
              try {
                const mRef = doc(db, 'chats', chatId, 'messages', mId);
                updateDoc(mRef, {
                  status: 'seen',
                  seenAt: Date.now(),
                }).catch(() => {});
              } catch {
                // ignore
              }
            });

            // Notify partner tab that their messages have been seen
            if (broadcastChannelRef.current) {
              try {
                broadcastChannelRef.current.postMessage({
                  type: 'messages_seen',
                  viewer: currentUser.username.toLowerCase(),
                });
              } catch {
                // ignore
              }
            }
          }

          // Trigger Stealth Gemini AI if new incoming partner message arrived
          if (!isFirstSnapshotRef.current && isAutoReplyEnabledRef.current) {
            const latestMsg = remoteMsgs[remoteMsgs.length - 1];
            if (
              latestMsg &&
              latestMsg.senderUsername.toLowerCase() !== currentUser.username.toLowerCase() &&
              !processedMessageIdsRef.current.has(latestMsg.messageId)
            ) {
              processedMessageIdsRef.current.add(latestMsg.messageId);
              dispatchAutoReplyForIncomingMessage(latestMsg);
            }
          }

          remoteMsgs.forEach((m) => processedMessageIdsRef.current.add(m.messageId));
          isFirstSnapshotRef.current = false;

          setMessages(remoteMsgs);

          // Update parent conversation summary
          if (remoteMsgs.length > 0) {
            const last = remoteMsgs[remoteMsgs.length - 1];
            saveConversationItem(currentUser.username, targetUser, last.text, last.createdAt);
          }
        },
        (err) => {
          console.warn('[ChatRoom] Firestore messages listener note:', err.message);
        }
      );

      return () => unsubscribe();
    } catch (e) {
      console.warn('[ChatRoom] Firestore listener setup notice:', e);
    }
  }, [chatId, currentUser.username, dispatchAutoReplyForIncomingMessage, targetUser]);

  // 7. Send Message Handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanText = inputText.trim();
    if (!cleanText) return;

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();

    const newMsg: ChatMessage = {
      messageId,
      chatId,
      senderUsername: currentUser.username,
      senderName: currentUser.fullName,
      text: cleanText,
      createdAt: now,
      status: 'sent',
    };

    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    emitTypingState(false);

    // Optimistic UI update
    setMessages((prev) => [...prev, newMsg]);
    saveConversationItem(currentUser.username, targetUser, cleanText, now);

    // Broadcast to local tabs
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

    // Persist to Firestore
    if (db) {
      try {
        const msgDocRef = doc(db, 'chats', chatId, 'messages', messageId);
        await setDoc(msgDocRef, {
          messageId,
          chatId,
          senderUsername: currentUser.username,
          senderName: currentUser.fullName,
          text: cleanText,
          createdAt: serverTimestamp(),
          status: 'delivered',
        });
      } catch (err) {
        console.warn('[ChatRoom] Message written to local cache:', err);
      }
    }
  };

  // 8. Unsend for Everyone (within 120 seconds / 2 minutes)
  const handleUnsendForEveryone = async (msg: ChatMessage) => {
    const elapsedSeconds = (Date.now() - msg.createdAt) / 1000;
    if (elapsedSeconds > 120) {
      showToast('Unsend is only allowed within 2 minutes of sending.');
      setSelectedMessageForAction(null);
      return;
    }

    // Remove from local state
    setMessages((prev) => prev.filter((m) => m.messageId !== msg.messageId));
    setSelectedMessageForAction(null);

    // Broadcast removal
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'unsend_message',
          messageId: msg.messageId,
        });
      } catch {
        // ignore
      }
    }

    // Delete in Firestore
    await unsendFirestoreMessage(chatId, msg.messageId);
    showToast('Message unsent for everyone');
  };

  // 9. Delete Permanently (Always available)
  const handleDeletePermanently = async (msg: ChatMessage) => {
    setMessages((prev) => prev.filter((m) => m.messageId !== msg.messageId));
    setSelectedMessageForAction(null);

    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'delete_message',
          messageId: msg.messageId,
        });
      } catch {
        // ignore
      }
    }

    await deleteFirestoreMessage(chatId, msg.messageId);
    showToast('Message deleted permanently');
  };

  // 10. Copy Message Text
  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Message copied to clipboard');
    setSelectedMessageForAction(null);
  };

  // Input change with typing emitter & multiline auto-expand
  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const val = e.target.value;
    setInputText(val);
    emitTypingState(true);

    // Auto-adjust textarea height up to 140px
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollH, 140)}px`;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitTypingState(false);
    }, 2000);
  };

  // Microphone helper
  const handleMicClick = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicNotice('Voice speech recognition not supported in this browser.');
      setTimeout(() => setMicNotice(null), 3000);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'hi-IN,en-IN';
      recognition.interimResults = false;

      recognition.onstart = () => {
        setMicActive(true);
        setMicNotice('Listening... Speak now');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = () => {
        setMicActive(false);
        setMicNotice('Microphone access unavailable or timed out.');
        setTimeout(() => setMicNotice(null), 3000);
      };

      recognition.onend = () => {
        setMicActive(false);
        setMicNotice(null);
      };

      recognition.start();
    } catch {
      setMicActive(false);
    }
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 11. Calculate latest outgoing message status for Cyberpunk Anime Eye dynamic background
  const latestOutgoingMessage = [...messages]
    .reverse()
    .find(
      (m) =>
        (m.senderUsername || '').trim().toLowerCase() ===
        currentUser.username.trim().toLowerCase()
    );

  // If there's an outgoing message:
  // - status === 'seen' => isEyeSeen = true (Neon Green + triggers blink transition)
  // - status === 'sent' || 'delivered' => isEyeSeen = false (Pulsing Neon Crimson Red)
  // If no outgoing message exists yet: default to true (ready / green)
  const isEyeSeen = latestOutgoingMessage
    ? latestOutgoingMessage.status === 'seen'
    : true;

  const eyeStatusKey = latestOutgoingMessage
    ? `${latestOutgoingMessage.messageId}_${latestOutgoingMessage.status}`
    : 'none';

  return (
    <div
      id="chatroom-screen"
      className="w-full h-screen bg-[#07090e] text-slate-100 flex flex-col justify-between select-none relative overflow-hidden"
    >
      {/* 1. Chat Header */}
      <header
        id="chatHeader"
        className="w-full px-3 sm:px-4 py-2.5 bg-[#0f121a]/95 backdrop-blur-xl border-b border-white/10 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0 shadow-lg"
      >
        {/* Left: Back button & Target User Profile with Real-time Presence */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            id="chatBackBtn"
            onClick={onBack}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer active:scale-95"
            title="Back to Inbox"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            {/* Circular Partner Avatar with Real-time Presence / Typing Badge */}
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-amber-500/60 to-amber-600/60 border border-amber-500/40 overflow-hidden flex items-center justify-center bg-[#161b26] shadow-md">
                {targetUser.avatarUrl ? (
                  <img
                    src={targetUser.avatarUrl}
                    alt={targetUser.fullName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-amber-300 font-bold text-sm">
                    {targetUser.fullName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {/* Presence / Typing Indicator Dot */}
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0f121a] ${
                  partnerTyping.isTyping
                    ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-ping'
                    : partnerPresence.isOnline
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse'
                    : 'bg-slate-500'
                }`}
                title={
                  partnerTyping.isTyping
                    ? 'Typing...'
                    : partnerPresence.isOnline
                    ? 'Online'
                    : 'Offline'
                }
              />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-white leading-tight truncate max-w-[150px] sm:max-w-[200px]">
                  {targetUser.fullName}
                </span>

                {partnerTyping.isTyping && (
                  <span className="text-[10px] font-mono text-amber-300 font-medium px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 animate-pulse">
                    typing...
                  </span>
                )}
              </div>

              {/* Status text: "Online" OR "Last seen [X] mins ago" */}
              <div className="flex items-center gap-1.5 text-[11px] font-mono leading-tight">
                <span className="text-amber-400/90">@{targetUser.username}</span>
                <span className="text-slate-500">•</span>
                {partnerTyping.isTyping ? (
                  <span className="text-amber-300 font-semibold animate-pulse">
                    typing...
                  </span>
                ) : partnerPresence.isOnline ? (
                  <span className="text-emerald-400 font-semibold">
                    Online
                  </span>
                ) : (
                  <span className="text-slate-400">
                    Last seen {formatLastSeen(partnerPresence.lastSeen)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Stealth Gemini AI Auto-Reply Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Conversation Style Selector Dropdown */}
          <div className="flex items-center gap-1.5 bg-[#161b26] border border-white/10 px-2.5 py-1.5 rounded-xl text-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              id="conversationStyleDropdown"
              value={autoReplyStyle}
              onChange={(e) => handleChangeStyle(e.target.value as AutoReplyStyle)}
              className="bg-transparent text-amber-300 text-xs font-medium focus:outline-none cursor-pointer pr-1"
              title="Select Conversation Style"
            >
              {STYLE_OPTIONS.map((styleOpt) => (
                <option
                  key={styleOpt.id}
                  value={styleOpt.id}
                  className="bg-[#161b26] text-slate-200"
                >
                  {styleOpt.label}
                </option>
              ))}
            </select>
          </div>

          {/* AI Auto-Reply Toggle (Default ON) */}
          <button
            id="aiAutoReplyToggleBtn"
            type="button"
            onClick={handleToggleAutoReply}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 ${
              isAutoReplyEnabled
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Stealth AI Auto-Reply"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isAutoReplyEnabled
                  ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.9)]'
                  : 'bg-slate-500'
              }`}
            />
            <span className="hidden xs:inline text-[11px]">Auto-Reply:</span>
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

          {/* Location Radar Toggle Button in Header */}
          <button
            id="locationRadarToggleBtn"
            type="button"
            onClick={handleToggleLocationRadar}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 ${
              locationSession?.status === 'active'
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : locationSession?.status === 'requested'
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse'
                : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30'
            }`}
            title="Mutual Two-Way Live Location Radar"
          >
            <Radio
              className={`w-3.5 h-3.5 text-cyan-400 ${
                locationSession?.status === 'active' ? 'animate-spin' : ''
              }`}
              style={locationSession?.status === 'active' ? { animationDuration: '4s' } : undefined}
            />
            <span className="text-[11px] font-semibold whitespace-nowrap">Live Radar</span>
            {locationSession?.status === 'active' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            ) : locationSession?.status === 'requested' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            ) : null}
          </button>
        </div>
      </header>

      {/* Mutual Two-Way Live Location Radar & Permission Banners */}
      <LiveLocationRadar
        chatId={chatId}
        currentUser={currentUser}
        partnerUser={targetUser}
        locationSession={locationSession}
      />

      {/* Toast Notice */}
      {toastNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 animate-fade-in">
          <span>{toastNotice}</span>
        </div>
      )}

      {/* Voice / Mic notice */}
      {micNotice && (
        <div className="w-full bg-rose-500/20 border-b border-rose-500/30 px-4 py-1 text-center text-xs text-rose-300 font-mono">
          {micNotice}
        </div>
      )}

      {/* 2. Messages Container with Dynamic Cyberpunk Anime Neon Eye Background */}
      <div className="flex-1 relative w-full overflow-hidden flex flex-col">
        {/* Customized Interactive Cyberpunk Anime Neon Eye Dynamic Background */}
        <CyberpunkAnimeEye
          isSeen={isEyeSeen}
          messageStatusKey={eyeStatusKey}
        />

        {/* Messages List Area */}
        <div
          id="messagesScrollArea"
          className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 flex flex-col gap-3 max-w-3xl w-full mx-auto relative z-10"
        >
          {/* Empty Conversation Welcome */}
        {messages.length === 0 && (
          <div className="w-full my-auto flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">
              End-to-End Encrypted Chat
            </h3>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-3">
              Send a message to start your private 1-on-1 conversation with @{targetUser.username}.
            </p>
            {targetUser.villageCity && (
              <span className="text-[11px] font-mono text-amber-300/80 bg-[#161b26] px-2.5 py-1 rounded-lg border border-white/10">
                Location: {targetUser.villageCity}
              </span>
            )}
          </div>
        )}

        {/* Dynamic Messages List */}
        {messages.map((msg) => {
          const isOutgoing =
            (msg.senderUsername || '').trim().toLowerCase() ===
            currentUser.username.trim().toLowerCase();

          return (
            <div
              key={msg.messageId}
              id={`message-${msg.messageId}`}
              className={`w-full flex flex-col group relative ${
                isOutgoing ? 'items-end' : 'items-start'
              }`}
            >
              {/* Sender Name above incoming partner message */}
              {!isOutgoing && (
                <span className="text-[11px] font-semibold text-amber-400/90 mb-1 ml-1 flex items-center gap-1 select-none">
                  <UserIcon className="w-3 h-3" />
                  {msg.senderName}
                </span>
              )}

              {/* Message Bubble + 3-Dot Action Trigger */}
              <div className={`relative flex items-center gap-1.5 max-w-[85%] sm:max-w-md ${isOutgoing ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Message Bubble */}
                <div
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setSelectedMessageForAction(msg);
                  }}
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-lg transition-all ${
                    isOutgoing
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-medium rounded-tr-none backdrop-blur-md shadow-amber-500/10'
                      : 'bg-[#0f121a]/85 backdrop-blur-md border border-white/10 text-slate-100 rounded-tl-none shadow-black/40'
                  }`}
                >
                  <p className="break-words whitespace-pre-wrap">{msg.text}</p>

                  {/* Footer: Timestamp & Ticks */}
                  <div
                    className={`text-[10px] font-mono mt-1.5 flex items-center justify-end gap-1.5 select-none ${
                      isOutgoing ? 'text-slate-900/80 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    <span>{formatTimestamp(msg.createdAt)}</span>

                    {/* Status Indicators for Outgoing (Right) Messages:
                        - Single tick (✓): Sent
                        - Double tick (✓✓) + small RED dot (🔴): Delivered (unread)
                        - Double tick (✓✓) + small GREEN dot (🟢): Seen / Read by partner
                    */}
                    {isOutgoing && (
                      <div className="flex items-center gap-1 ml-1 shrink-0">
                        {msg.status === 'seen' ? (
                          <span
                            className="inline-flex items-center gap-1 text-slate-950 font-bold"
                            title="Seen / Read by partner"
                          >
                            <CheckCheck className="w-3.5 h-3.5 text-slate-950" strokeWidth={2.6} />
                            <span className="w-2 h-2 rounded-full bg-emerald-600 ring-1 ring-emerald-950/40 shadow-[0_0_5px_rgba(5,150,105,0.9)]" />
                          </span>
                        ) : msg.status === 'delivered' ? (
                          <span
                            className="inline-flex items-center gap-1 text-slate-900/90 font-medium"
                            title="Delivered (Unread)"
                          >
                            <CheckCheck className="w-3.5 h-3.5 text-slate-900" strokeWidth={2} />
                            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse ring-1 ring-rose-950/40 shadow-[0_0_5px_rgba(225,29,72,0.9)]" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-slate-900/80" title="Sent">
                            <Check className="w-3.5 h-3.5" strokeWidth={2} />
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3-Dot Message Action Trigger Button */}
                <button
                  type="button"
                  onClick={() => setSelectedMessageForAction(msg)}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-opacity cursor-pointer shrink-0"
                  title="Message options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Partner Typing Bubble */}
        {partnerTyping.isTyping && (
          <div
            id="partnerTypingIndicator"
            className="w-full flex flex-col items-start transition-all animate-fade-in"
          >
            <span className="text-[11px] font-semibold text-amber-400/90 mb-1 ml-1 flex items-center gap-1">
              <UserIcon className="w-3 h-3" />
              {partnerTyping.name}
            </span>
            <div className="bg-[#0f121a]/85 backdrop-blur-md border border-white/10 text-slate-300 px-4 py-2.5 rounded-2xl rounded-tl-none flex items-center gap-2.5 text-xs shadow-md">
              <span className="text-slate-400 font-medium">
                {partnerTyping.name} is typing
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" />
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="h-2" />
      </div>
    </div>

      {/* 3. Bottom Input Action Bar */}
      <div
        id="chatInputBar"
        className="w-full bg-[#0f121a]/95 backdrop-blur-xl border-t border-white/10 p-3 sm:p-4 z-20 shrink-0"
      >
        <form
          onSubmit={(e) => e.preventDefault()}
          className="max-w-3xl mx-auto flex items-end gap-2"
        >
          {/* Voice Microphone */}
          <button
            id="chatVoiceBtn"
            type="button"
            onClick={handleMicClick}
            className={`p-3 rounded-xl border transition-all cursor-pointer active:scale-95 shrink-0 mb-0.5 ${
              micActive
                ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/30 animate-pulse'
                : 'bg-[#161b26] border-white/10 text-slate-300 hover:text-amber-400 hover:border-amber-500/40'
            }`}
            title="Voice-to-Text Microphone"
          >
            <Mic className="w-5 h-5" />
          </button>

          {/* Location Radar Toggle Button in Input Bar */}
          <button
            id="chatInputRadarBtn"
            type="button"
            onClick={handleToggleLocationRadar}
            className={`p-3 rounded-xl border transition-all cursor-pointer active:scale-95 shrink-0 mb-0.5 ${
              locationSession?.status === 'active'
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-md shadow-cyan-500/20'
                : locationSession?.status === 'requested'
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse'
                : 'bg-[#161b26] border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40'
            }`}
            title={
              locationSession?.status === 'active'
                ? 'Location Radar Active (Tap to Stop)'
                : locationSession?.status === 'requested'
                ? 'Location Radar Requested'
                : 'Share Mutual Live Location Radar'
            }
          >
            <Radio
              className={`w-5 h-5 ${
                locationSession?.status === 'active' ? 'text-cyan-400 animate-spin' : ''
              }`}
              style={locationSession?.status === 'active' ? { animationDuration: '4s' } : undefined}
            />
          </button>

          {/* Multiline Textarea (Enter creates newline, message never sends on Enter) */}
          <textarea
            id="chatMessageInput"
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 max-h-36 min-h-[44px] px-4 py-3 bg-[#161b26] border border-white/10 focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all resize-none leading-relaxed overflow-y-auto"
          />

          {/* Send Button: Dedicated tap/click to send */}
          <button
            id="chatSendBtn"
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim()}
            className={`p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl font-bold transition-all shadow-md active:scale-95 shrink-0 mb-0.5 ${
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

      {/* 4. Message Action Modal (2-Minute Unsend & Permanent Delete) */}
      {selectedMessageForAction && (
        <div
          id="messageActionBackdrop"
          onClick={() => setSelectedMessageForAction(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#0f121a] border border-white/10 p-5 flex flex-col gap-4 shadow-2xl relative animate-fade-in"
          >
            {/* Header with snippet */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-bold text-slate-300">Message Controls</span>
              <button
                type="button"
                onClick={() => setSelectedMessageForAction(null)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#161b26] border border-white/[0.06] text-xs text-slate-300 max-h-24 overflow-y-auto whitespace-pre-wrap">
              "{selectedMessageForAction.text}"
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              {/* UNSEND FOR EVERYONE (Strictly within 120s) */}
              {(() => {
                const isMine =
                  selectedMessageForAction.senderUsername.toLowerCase() ===
                  currentUser.username.toLowerCase();
                const elapsedSec = Math.floor(
                  (Date.now() - selectedMessageForAction.createdAt) / 1000
                );
                const remainingSec = 120 - elapsedSec;
                const canUnsend = isMine && remainingSec > 0;

                if (canUnsend) {
                  return (
                    <button
                      id="unsendForEveryoneBtn"
                      type="button"
                      onClick={() => handleUnsendForEveryone(selectedMessageForAction)}
                      className="w-full py-3 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-rose-400" />
                        <span>Unsend for Everyone</span>
                      </div>
                      <span className="text-[10px] font-mono text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-full">
                        {Math.floor(remainingSec / 60)}m {remainingSec % 60}s left
                      </span>
                    </button>
                  );
                }
                return null;
              })()}

              {/* DELETE PERMANENTLY (Always available) */}
              <button
                id="deletePermanentlyBtn"
                type="button"
                onClick={() => handleDeletePermanently(selectedMessageForAction)}
                className="w-full py-3 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-200 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-slate-400" />
                <span>Delete Permanently</span>
              </button>

              {/* COPY MESSAGE */}
              <button
                type="button"
                onClick={() => handleCopyMessage(selectedMessageForAction.text)}
                className="w-full py-2.5 px-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] text-slate-400 hover:text-white text-xs font-medium flex items-center gap-2 transition-all cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Text</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
