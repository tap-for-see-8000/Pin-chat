const fs = require('fs');

const code = `import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MessageSquare, AlertCircle, Loader2, Shield, Plus, X } from 'lucide-react';
import { UserRecord, PublicUserProfile, ChatConversation } from '../types';
import { searchUserByUsername, getSavedConversations, saveConversationItem, getChatId } from '../userService';
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
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const [conversations, setConversations] = useState<ChatConversation[]>(() =>
    getSavedConversations(currentUser.username)
  );

  const [pendingChat, setPendingChat] = useState<{
    targetUser: PublicUserProfile;
    chatId: string;
  } | null>(null);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchError(null);
    setFoundUser(null);
    
    try {
      const result = await searchUserByUsername(searchQuery.trim(), currentUser.username);
      if (!result.exists || !result.user) {
        setSearchError('IDENTIFIER NOT FOUND');
      } else {
        setFoundUser(result.user);
      }
    } catch (err) {
      setSearchError('CONNECTION FAILED');
    } finally {
      setIsSearching(false);
    }
  };

  const handleInitiateChat = (targetUser: PublicUserProfile) => {
    const chatId = getChatId(currentUser.username, targetUser.username);
    setPendingChat({ targetUser, chatId });
    setIsSearchModalOpen(false);
  };

  const handleGatewayVerified = (isDecoy: boolean) => {
    if (pendingChat) {
      const newConv = {
        chatId: pendingChat.chatId,
        otherUser: pendingChat.targetUser,
        lastMessageText: isDecoy ? 'Secure connection established' : 'Start conversation',
        lastMessageTime: Date.now(),
      };
      saveConversationItem(currentUser.username, newConv.otherUser, newConv.lastMessageText, newConv.lastMessageTime);
      setConversations(getSavedConversations(currentUser.username));
      
      onOpenChat(pendingChat.targetUser, pendingChat.chatId, isDecoy);
      setPendingChat(null);
    }
  };

  const formatRelativeTime = (timestamp: number) => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const daysDifference = Math.round((timestamp - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysDifference === 0) {
      const hoursDiff = Math.round((timestamp - Date.now()) / (1000 * 60 * 60));
      if (hoursDiff === 0) {
        const minsDiff = Math.round((timestamp - Date.now()) / (1000 * 60));
        return rtf.format(minsDiff, 'minute');
      }
      return rtf.format(hoursDiff, 'hour');
    }
    return rtf.format(daysDifference, 'day');
  };

  return (
    <div
      id="inbox-screen"
      className="w-full min-h-screen text-white select-none flex flex-col items-center relative overflow-x-hidden pb-32 bg-transparent"
    >
      {/* 1. Header Bar */}
      <header
        id="inboxHeader"
        className="w-full max-w-2xl px-6 py-4 glass-panel border-b-0 border-x-0 border-t-0 rounded-none flex items-center justify-between z-20 shrink-0 sticky top-0"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg glass-panel-heavy flex items-center justify-center text-white">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-display font-bold tracking-widest uppercase">
              Chat
            </h1>
          </div>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="w-full max-w-2xl px-6 py-6 flex flex-col gap-6 flex-1 z-10">
        
        {/* CONTENT AREA: DIRECT MESSAGES INBOX */}
        <div className="w-full flex flex-col gap-3">
          <h2 className="text-[10px] font-tech uppercase tracking-[0.2em] text-white/40 px-1 flex justify-between items-center border-b border-white/10 pb-2">
            <span>// ACTIVE_SESSIONS</span>
            <span className="text-[#AFDDFF] bg-[#AFDDFF]/10 px-1.5 py-0.5 rounded text-[9px]">{conversations.length}</span>
          </h2>

          {conversations.length > 0 ? (
            <div className="w-full flex flex-col gap-2 mt-2">
              {conversations.map((conv) => (
                <div key={conv.chatId} onClick={() => handleInitiateChat(conv.otherUser)} className="w-full p-4 rounded-lg glass-panel hover:bg-white/5 flex items-center justify-between gap-4 cursor-pointer transition-all active:scale-[0.98] group relative overflow-hidden">
                  <div className="flex items-center gap-4 min-w-0 flex-1 z-10">
                    <div className="w-12 h-12 rounded-full bg-black border border-white/10 flex items-center justify-center text-white/50 font-tech text-lg shrink-0 group-hover:border-[#AFDDFF]/50 transition-colors">
                      {conv.otherUser.avatarUrl ? (
                        <img src={conv.otherUser.avatarUrl} alt={conv.otherUser.fullName} className="w-full h-full rounded-full object-cover filter grayscale group-hover:grayscale-0 transition-all" />
                      ) : conv.otherUser.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-display font-bold truncate uppercase group-hover:text-[#AFDDFF] transition-colors">
                          {conv.otherUser.fullName}
                        </span>
                        <span className="text-[9px] font-tech text-white/40 shrink-0 uppercase tracking-widest">
                          {formatRelativeTime(conv.lastMessageTime)}
                        </span>
                      </div>
                      <div className="text-xs font-sans text-white/50 truncate mt-1 group-hover:text-white/70">
                        {conv.lastMessageText}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full py-16 px-6 rounded-lg glass-panel-heavy flex flex-col items-center justify-center text-center mt-2">
              <div className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center mb-4 text-[#AFDDFF]/50 shadow-[0_0_15px_rgba(175,221,255,0.1)]">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-[10px] font-tech text-[#AFDDFF]/60 uppercase tracking-[0.2em] mb-4">
                // SECURE_CHANNEL
              </h3>
              <h3 className="text-sm font-sans font-bold text-white/80 mb-2">
                अभी कोई चैट नहीं है
              </h3>
              <p className="text-xs font-sans text-white/40 max-w-[200px] leading-relaxed">
                ＋ से यूज़र जोड़ें
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => {
          setIsSearchModalOpen(true);
          setSearchError(null);
          setFoundUser(null);
          setSearchQuery('');
        }}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full glass-panel-heavy border border-white/20 flex items-center justify-center text-white hover:text-[#AFDDFF] hover:border-[#AFDDFF]/50 shadow-[0_0_20px_rgba(0,0,0,0.5)] z-40 transition-all active:scale-95 group"
      >
        <div className="absolute inset-0 rounded-full bg-[#AFDDFF]/0 group-hover:bg-[#AFDDFF]/10 transition-colors pointer-events-none" />
        <Plus className="w-6 h-6 relative z-10" />
      </button>

      {/* User Search Modal */}
      <AnimatePresence>
        {isSearchModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md glass-panel-heavy rounded-2xl p-6 relative overflow-hidden"
            >
              <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
              
              <div className="flex justify-between items-center mb-6 relative z-10">
                <div>
                  <h2 className="text-lg font-display font-bold uppercase tracking-widest text-white">Add User</h2>
                  <div className="text-[10px] font-tech text-[#AFDDFF] uppercase tracking-[0.2em] mt-1">// SEARCH_NODE</div>
                </div>
                <button
                  onClick={() => setIsSearchModalOpen(false)}
                  className="w-8 h-8 rounded-full glass-panel flex items-center justify-center text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="w-full flex flex-col gap-4 relative z-10">
                <form
                  onSubmit={handleSearchSubmit}
                  className="w-full relative flex items-center"
                >
                  <div className="absolute left-4 text-white/40 flex items-center justify-center">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="यूज़रनेम खोजें..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchError(null);
                      setFoundUser(null);
                    }}
                    className="w-full pl-11 pr-28 py-3.5 rounded-lg glass-panel text-white placeholder-white/30 font-tech text-xs tracking-widest focus:outline-none focus:border-[#AFDDFF] focus:bg-white/5 transition-all"
                    maxLength={30}
                    autoComplete="off"
                    spellCheck="false"
                  />
                  <button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="absolute right-2 top-2 bottom-2 px-4 bg-white/10 hover:bg-[#AFDDFF] text-white hover:text-black font-tech font-bold uppercase tracking-wider rounded-md text-[10px] flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                  >
                    {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
                  </button>
                </form>

                {/* Search Error */}
                {searchError && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-lg glass-panel border-l-2 border-[#FF3366] text-[#FF3366] text-xs flex items-start gap-2 bg-[#FF3366]/5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="font-tech mt-0.5 uppercase tracking-wider">{searchError}</span>
                  </motion.div>
                )}

                {/* Valid User Found Result Card */}
                {foundUser && (
                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="p-4 rounded-lg glass-panel border-[#AFDDFF]/30 flex flex-col gap-4 relative overflow-hidden bg-white/5">
                    <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-[#AFDDFF]/30" />
                    <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-[#AFDDFF]/30" />
                    
                    <div className="text-[9px] font-tech text-[#AFDDFF] uppercase tracking-[0.2em] mb-1">// USER_FOUND</div>
                    
                    <div className="flex items-center gap-4 min-w-0 z-10">
                      <div className="w-14 h-14 rounded-full bg-black border border-[#AFDDFF]/30 flex items-center justify-center text-white/60 font-tech text-xl shrink-0 overflow-hidden shadow-[0_0_15px_rgba(175,221,255,0.1)]">
                        {foundUser.avatarUrl ? (
                          <img src={foundUser.avatarUrl} alt={foundUser.fullName} className="w-full h-full object-cover filter grayscale" />
                        ) : foundUser.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-display font-bold truncate uppercase text-white">{foundUser.fullName}</div>
                        <div className="text-[11px] font-tech text-white/50 truncate tracking-widest mt-0.5">@{foundUser.username}</div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleInitiateChat(foundUser)} 
                      className="w-full py-3 bg-[#AFDDFF] hover:bg-white text-black font-tech font-bold uppercase tracking-widest rounded-md text-[11px] transition-all active:scale-95 z-10 mt-2"
                    >
                      Start Chat
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Secret Emoji Gateway Interstitial Modal */}
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
`;

fs.writeFileSync('src/components/InboxScreen.tsx', code);
