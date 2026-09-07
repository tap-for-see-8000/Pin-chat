/**
 * PIN Chat - Core Application Orchestrator
 * Package: com.aistudio.pinchat.kpmd
 * 
 * Features:
 * 1. Persistent User Session via localStorage
 * 2. Auth Screen (Registration & Credentials generation + Login)
 * 3. Instagram-Style Chat Inbox with exact Username Search
 * 4. Secret Pass-Emoji Gateway with Decoy (Amazon/Zomato/Courier) Chat
 * 5. Direct 1-on-1 Chat Room with Presence, Ticks, 2-Min Unsend & Stealth Gemini AI
 */

import React, { useState, useEffect } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { InboxScreen } from './components/InboxScreen';
import { ChatRoomScreen } from './components/ChatRoomScreen';
import { DecoyChatScreen } from './components/DecoyChatScreen';
import { UserRecord, PublicUserProfile, AppScreen } from './types';
import { getCurrentSession, clearCurrentSession, updateUserPresence } from './userService';

export default function App() {
  // Restore logged-in user from localStorage session (refresh never logs out)
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(() => getCurrentSession());

  // Determine initial screen based on persisted session
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(() =>
    getCurrentSession() ? 'inbox' : 'auth'
  );

  // Active 1-on-1 chat state
  const [activeTargetUser, setActiveTargetUser] = useState<PublicUserProfile | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isDecoyMode, setIsDecoyMode] = useState<boolean>(false);

  // Maintain presence heartbeat for current logged-in user
  useEffect(() => {
    if (!currentUser) return;

    // Immediately mark online
    updateUserPresence(currentUser.username, true);

    // Heartbeat every 25 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updateUserPresence(currentUser.username, true);
      }
    }, 25000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateUserPresence(currentUser.username, true);
      } else {
        updateUserPresence(currentUser.username, false);
      }
    };

    const handleBeforeUnload = () => {
      updateUserPresence(currentUser.username, false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser]);

  // Auth Success Handler (Registration or Login)
  const handleAuthSuccess = (user: UserRecord) => {
    setCurrentUser(user);
    setCurrentScreen('inbox');
  };

  // Open Direct 1-on-1 Chat Handler (Real vs Decoy)
  const handleOpenChat = (
    targetUser: PublicUserProfile,
    chatId: string,
    isDecoy = false
  ) => {
    setActiveTargetUser(targetUser);
    setActiveChatId(chatId);
    setIsDecoyMode(isDecoy);
    setCurrentScreen('chat');
  };

  // Back to Inbox Handler
  const handleBackToInbox = () => {
    setCurrentScreen('inbox');
    setActiveTargetUser(null);
    setActiveChatId(null);
    setIsDecoyMode(false);
  };

  // Logout Handler
  const handleLogout = () => {
    if (currentUser) {
      updateUserPresence(currentUser.username, false);
    }
    clearCurrentSession();
    setCurrentUser(null);
    setActiveTargetUser(null);
    setActiveChatId(null);
    setIsDecoyMode(false);
    setCurrentScreen('auth');
  };

  return (
    <div
      id="app-container"
      className="w-full min-h-screen bg-[#07090e] text-slate-100 selection:bg-amber-500/30 selection:text-amber-200 relative font-sans"
    >
      {/* 1. Auth Screen (Registration & Login) */}
      {currentScreen === 'auth' && (
        <AuthScreen onAuthSuccess={handleAuthSuccess} />
      )}

      {/* 2. Instagram-Style Chat Inbox & User Search */}
      {currentScreen === 'inbox' && currentUser && (
        <InboxScreen
          currentUser={currentUser}
          onOpenChat={handleOpenChat}
          onLogout={handleLogout}
        />
      )}

      {/* 3. Decoy Courier/Order Chat (when wrong pass-emoji is entered) */}
      {currentScreen === 'chat' && currentUser && activeTargetUser && isDecoyMode && (
        <DecoyChatScreen
          targetUser={activeTargetUser}
          onBack={handleBackToInbox}
          onUnlockRealChat={() => setIsDecoyMode(false)}
        />
      )}

      {/* 4. Real Authentic 1-on-1 Chat Room (when correct pass-emoji is verified) */}
      {currentScreen === 'chat' && currentUser && activeTargetUser && activeChatId && !isDecoyMode && (
        <ChatRoomScreen
          chatId={activeChatId}
          currentUser={currentUser}
          targetUser={activeTargetUser}
          onBack={handleBackToInbox}
        />
      )}
    </div>
  );
}
