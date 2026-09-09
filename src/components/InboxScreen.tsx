/**
 * PIN Chat - Instagram-Style Chat Inbox & User Search Screen
 * Package: com.aistudio.pinchat.kpmd
 * 
 * Features:
 * 1. Top Bar with Logged-in User Profile & Logout button
 * 2. Strict Username Search:
 *    - Queries Firestore 'users' by exact username
 *    - Only allows starting a chat if username is already registered
 *    - If not found, displays exact error: "User not found"
 *    - Shows result card with Name, Username, Location, and "Chat" button
 * 3. Instagram-style Direct Messages Inbox list:
 *    - Real-time updates & persistent conversation tracking
 * 4. Emoji Security Gateway trigger before opening any chat:
 *    - First-time setup vs verification
 *    - Silently routes to Decoy chat on wrong emoji
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  MessageSquare,
  LogOut,
  User as UserIcon,
  MapPin,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Loader2,
  Shield,
  Clock,
  ChevronRight,
  X,
  Lock,
  Users,
  RefreshCw,
} from 'lucide-react';
import { UserRecord, PublicUserProfile, ChatConversation } from '../types';
import {
  searchUserByUsername,
  getSavedConversations,
  saveConversationItem,
  getChatId,
  clearCurrentSession,
  subscribeToUserPresence,
  maskPhone,
  getAllRegisteredUsers,
} from '../userService';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { EmojiGatewayModal } from './EmojiGatewayModal';

interface InboxScreenProps {
  currentUser: UserRecord;
  onOpenChat: (targetUser: PublicUserProfile, chatId: string, isDecoy?: boolean) => void;
  onLogout: () => void;
}

export const InboxScreen: React.FC<InboxScreenProps> = ({
  currentUser,
  onOpenChat,
  onLogout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundUser, setFoundUser] = useState<PublicUserProfile | null>(null);

  // Active Conversations List
  const [conversations, setConversations] = useState<ChatConversation[]>(() =>
    getSavedConversations(currentUser.username)
  );

  // Emoji Gateway Interstitial State
  const [pendingChat, setPendingChat] = useState<{
    targetUser: PublicUserProfile;
    chatId: string;
  } | null>(null);

  // Sync conversations from Firestore 'chats' collection
  useEffect(() => {
    if (!db) return;

    try {
      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('participants', 'array-contains', currentUser.username.toLowerCase())
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: ChatConversation[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              const participants = (data.participants || []) as string[];
              const otherUsername = participants.find(
                (u) => u !== currentUser.username.toLowerCase()
              );

              if (otherUsername) {
                list.push({
                  chatId: docSnap.id,
                  otherUser: {
                    username: otherUsername,
                    fullName: (data.participantNames && data.participantNames[otherUsername]) || otherUsername,
                  },
                  lastMessageText: data.lastMessageText || 'Chat started',
                  lastMessageTime: data.lastMessageTime || data.updatedAt || Date.now(),
                });
              }
            });

            // Merge with local conversations
            if (list.length > 0) {
              setConversations((prev) => {
                const map = new Map<string, ChatConversation>();
                prev.forEach((c) => map.set(c.chatId, c));
                list.forEach((c) => map.set(c.chatId, c));
                return Array.from(map.values()).sort(
                  (a, b) => b.lastMessageTime - a.lastMessageTime
                );
              });
            }
          }
        },
        (err) => {
          console.warn('[InboxScreen] Firestore chats sync note:', err.message);
        }
      );

      return () => unsubscribe();
    } catch (e) {
      console.warn('[InboxScreen] Firestore listener setup notice:', e);
    }
  }, [currentUser.username]);

  // Handle Search Submission
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchQuery.trim().toLowerCase();

    if (!clean) return;

    setIsSearching(true);
    setSearchError(null);
    setFoundUser(null);

    try {
      const res = await searchUserByUsername(clean, currentUser.username);

      if (!res.exists || !res.user) {
        setIsSearching(false);
        setSearchError(res.error || 'User not found');
        return;
      }

      // Valid registered user found
      setFoundUser(res.user);
      setIsSearching(false);
    } catch (err) {
      setIsSearching(false);
      console.error('[InboxScreen] Search error:', err);
      setSearchError('User not found');
    }
  };

  // Intercept Chat Entry through Emoji Security Gateway
  const handleInitiateChat = (userToChat: PublicUserProfile) => {
    const chatId = getChatId(currentUser.username, userToChat.username);

    // Save into conversations list so it appears in Inbox
    saveConversationItem(
      currentUser.username,
      userToChat,
      'Chat started',
      Date.now()
    );

    // Prompt the Emoji Security Gateway before opening the chat
    setPendingChat({
      targetUser: userToChat,
      chatId,
    });
  };

  // Called when Emoji Gateway finishes verification
  const handleGatewayVerified = (isDecoy: boolean) => {
    if (!pendingChat) return;
    const { targetUser, chatId } = pendingChat;
    setPendingChat(null);
    onOpenChat(targetUser, chatId, isDecoy);
  };

  const handleLogoutClick = () => {
    clearCurrentSession();
    onLogout();
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div
      id="inbox-screen"
      className="w-full min-h-screen bg-[#07090e] text-slate-100 select-none flex flex-col items-center relative overflow-x-hidden pb-24"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* 1. Header Bar */}
      <header
        id="inboxHeader"
        className="w-full max-w-2xl px-4 py-3 bg-[#0f121a]/95 backdrop-blur-xl border-b border-white/10 flex items-center justify-between z-20 shrink-0 sticky top-0 shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-extrabold text-white tracking-tight">
                PIN Chat
              </h1>
              <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                Direct
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
              <span>Logged in as:</span>
              <span className="font-bold text-amber-300">@{currentUser.username}</span>
            </div>
          </div>
        </div>

        {/* User Badge & Logout */}
        <div className="flex items-center gap-2">
          <button
            id="logoutBtn"
            onClick={handleLogoutClick}
            className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/30 text-slate-300 hover:text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Log out from this device"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="w-full max-w-2xl px-4 py-5 flex flex-col gap-5 flex-1 z-10">
        {/* User Status Card */}
        <div className="w-full p-4 rounded-2xl bg-[#0f121a]/90 border border-white/10 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-amber-500 to-amber-600 border border-amber-500/40 overflow-hidden flex items-center justify-center shrink-0 shadow-md">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.fullName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-amber-300 font-bold text-lg">
                  {currentUser.fullName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white truncate">
                  {currentUser.fullName}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)] shrink-0" title="Online" />
              </div>
              <span className="text-xs font-mono text-amber-300/90 block">
                @{currentUser.username}
              </span>
              {currentUser.villageCity && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                  <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate">{currentUser.villageCity}</span>
                </span>
              )}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 shrink-0" title="Vault Protected">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        {/* 3. Search Bar */}
        <div className="w-full flex flex-col gap-3">
          <form
            onSubmit={handleSearchSubmit}
            className="relative w-full flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="searchUsernameInput"
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (searchError) setSearchError(null);
                }}
                placeholder="Search registered username (e.g. mohit8976)..."
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full pl-10 pr-9 py-3 bg-[#161b26] border border-white/10 focus:border-amber-500/80 rounded-xl text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchError(null);
                    setFoundUser(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
              <button
                id="submitSearchBtn"
                type="submit"
                disabled={!searchQuery.trim() || isSearching}
                className="px-4 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed shadow-md shrink-0 active:scale-95"
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Search</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
          </form>



          {/* Search Error: Strictly "User not found" */}
          {searchError && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              id="searchErrorMessage"
              className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-semibold">{searchError}</span>
            </motion.div>
          )}

          {/* Valid User Found Result Card */}
          {foundUser && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              id="foundUserCard"
              className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 to-[#161b26] border border-amber-500/40 flex items-center justify-between shadow-lg"
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="w-11 h-11 rounded-full p-0.5 bg-gradient-to-tr from-amber-500/60 to-amber-600/60 border border-amber-500/40 overflow-hidden flex items-center justify-center text-amber-300 font-bold text-base shrink-0 shadow-md">
                  {foundUser.avatarUrl ? (
                    <img
                      src={foundUser.avatarUrl}
                      alt={foundUser.fullName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span>{foundUser.fullName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">
                    {foundUser.fullName}
                  </div>
                  <div className="text-xs font-mono font-semibold text-amber-400 truncate">
                    @{foundUser.username}
                  </div>
                  {foundUser.villageCity && (
                    <div className="text-[11px] text-slate-400 truncate">
                      {foundUser.villageCity}
                    </div>
                  )}
                </div>
              </div>

              <button
                id="startChatWithUserBtn"
                onClick={() => handleInitiateChat(foundUser)}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Chat</span>
              </button>
            </motion.div>
          )}
        </div>

        {/* 4. CONTENT AREA: DIRECT MESSAGES INBOX */}
        <div className="w-full flex flex-col gap-2.5 mt-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Direct Messages</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {conversations.length} {conversations.length === 1 ? 'chat' : 'chats'}
            </span>
          </div>

          {/* Conversations Items */}
            {conversations.length > 0 ? (
              <div className="w-full flex flex-col gap-2">
                {conversations.map((conv) => (
                  <div
                    key={conv.chatId}
                    id={`conversation-${conv.chatId}`}
                    onClick={() => handleInitiateChat(conv.otherUser)}
                    className="w-full p-3.5 rounded-2xl bg-[#0f121a]/95 hover:bg-[#161b26] border border-white/[0.08] hover:border-amber-500/40 flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] group shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Participant Circular Avatar */}
                      <div className="w-11 h-11 rounded-full p-0.5 bg-amber-500/20 border border-amber-500/30 overflow-hidden flex items-center justify-center text-amber-300 font-bold text-base shrink-0 group-hover:scale-105 transition-transform shadow-sm">
                        {conv.otherUser.avatarUrl ? (
                          <img
                            src={conv.otherUser.avatarUrl}
                            alt={conv.otherUser.fullName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span>{conv.otherUser.fullName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                            {conv.otherUser.fullName}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0">
                            {formatRelativeTime(conv.lastMessageTime)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className="text-xs text-slate-400 truncate max-w-[220px] sm:max-w-xs block">
                            {conv.lastMessageText}
                          </span>
                          <span className="text-[10px] font-mono text-amber-400/80 shrink-0">
                            @{conv.otherUser.username}
                          </span>
                        </div>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              /* Empty Inbox State with Quick Action to View All Users */
              <div
                id="emptyInboxState"
                className="w-full py-12 px-6 rounded-2xl bg-[#0f121a]/70 border border-white/[0.06] flex flex-col items-center justify-center text-center my-2"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">
                  No conversations yet
                </h3>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Search for a user by their registered username to start an instant encrypted chat!
                </p>
              </div>
            )}
        </div>
      </main>

      {/* 5. Secret Emoji Gateway Interstitial Modal */}
      {pendingChat && (
        <EmojiGatewayModal
          isOpen={Boolean(pendingChat)}
          targetUser={pendingChat.targetUser}
          chatId={pendingChat.chatId}
          currentUsername={currentUser.username}
          onVerified={handleGatewayVerified}
          onClose={() => setPendingChat(null)}
        />
      )}
    </div>
  );
};
