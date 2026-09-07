/**
 * PIN Chat - Core Application Orchestrator
 * Package: com.aistudio.pinchat.kpmd
 */

import React, { useState, useEffect } from 'react';
import { SplashScreen } from './components/SplashScreen';
import { ProfileSetupScreen } from './components/ProfileSetupScreen';
import { HomeScreen } from './components/HomeScreen';
import { CreateChatModal } from './components/CreateChatModal';
import { JoinChatModal } from './components/JoinChatModal';
import { ChatRoomScreen } from './components/ChatRoomScreen';
import { AppScreen, UserProfile } from './types';
import { auth, subscribeToAuth } from './firebase';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('splash');
  const [activeModal, setActiveModal] = useState<'none' | 'create' | 'join'>('none');
  const [currentRoomPin, setCurrentRoomPin] = useState<string | null>(null);

  const [userProfile, setUserProfile] = useState<Partial<UserProfile>>(() => {
    // Try to restore saved profile from localStorage if any
    try {
      const saved = localStorage.getItem('pinchat_user_profile');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      displayName: '',
      mobileNumber: '',
      villageCity: '',
      pinCode: '',
    };
  });

  // Listen to Firebase Auth state (persisted in indexedDB)
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      if (user) {
        console.log('[PIN Chat] Verified Firebase Anonymous User UID:', user.uid);
        setUserProfile((prev) => {
          const updated = {
            ...prev,
            uid: user.uid,
            authProvider: 'anonymous' as const,
          };
          try {
            localStorage.setItem('pinchat_user_profile', JSON.stringify(updated));
          } catch {
            // ignore
          }
          return updated;
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Handler for Screen 1 (Splash / Welcome Screen)
  const handleSplashComplete = (fullName: string, _firstName: string) => {
    setUserProfile((prev) => ({
      ...prev,
      displayName: fullName,
    }));
    setCurrentScreen('profile');
  };

  // Handler for Screen 2 (Profile Setup Screen)
  const handleProfileComplete = (profile: UserProfile) => {
    setUserProfile(profile);
    try {
      localStorage.setItem('pinchat_user_profile', JSON.stringify(profile));
    } catch {
      // ignore
    }
    setCurrentScreen('home');
  };

  // Handler for Entering Chat Room from Create or Join
  const handleEnterChat = (pin: string) => {
    setCurrentRoomPin(pin);
    setActiveModal('none');
    setCurrentScreen('chat');
  };

  return (
    <div id="app-container" className="w-full min-h-screen bg-[#07090e] text-slate-100 selection:bg-amber-500/30 selection:text-amber-200 relative">
      {currentScreen === 'splash' && (
        <SplashScreen onComplete={handleSplashComplete} />
      )}

      {currentScreen === 'profile' && (
        <ProfileSetupScreen
          initialName={userProfile.displayName || ''}
          onComplete={handleProfileComplete}
        />
      )}

      {currentScreen === 'home' && (
        <>
          <HomeScreen
            user={userProfile}
            onEnterRoom={handleEnterChat}
            onCreateChat={() => setActiveModal('create')}
            onJoinChat={() => setActiveModal('join')}
          />

          {/* Screen 4: Create Chat Modal */}
          {activeModal === 'create' && (
            <CreateChatModal
              user={userProfile}
              onEnterRoom={handleEnterChat}
              onClose={() => setActiveModal('none')}
            />
          )}

          {/* Screen 5: Join Chat Modal */}
          {activeModal === 'join' && (
            <JoinChatModal
              user={userProfile}
              onJoin={handleEnterChat}
              onClose={() => setActiveModal('none')}
            />
          )}
        </>
      )}

      {currentScreen === 'chat' && currentRoomPin && (
        <ChatRoomScreen
          pin={currentRoomPin}
          user={userProfile}
          onBack={() => {
            setCurrentScreen('home');
          }}
        />
      )}
    </div>
  );
}
