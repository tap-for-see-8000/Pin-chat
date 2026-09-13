import React, { useState, useEffect, useRef } from 'react';
import { Home, MessageCircle, BarChart2, User, Shield } from 'lucide-react';
import { AppScreen } from '../types';

interface BottomNavigationProps {
  currentScreen: AppScreen;
  onNavigate: (screen: 'mood' | 'inbox' | 'profile' | 'weekly_report' | 'focus') => void;
}

export function BottomNavigation({ currentScreen, onNavigate }: BottomNavigationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartY = useRef<number | null>(null);

  const navItems = [
    { id: 'mood', icon: Home, label: 'CMD' },
    { id: 'inbox', icon: MessageCircle, label: 'COMMS' },
    { id: 'focus', icon: Shield, label: 'FOCUS' },
    { id: 'weekly_report', icon: BarChart2, label: 'DATA' },
    { id: 'profile', icon: User, label: 'ID' }
  ] as const;

  const startHideTimer = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 4000);
  };

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
      if (isVisible) {
        // Reset timer if touching while visible
        startHideTimer();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartY.current === null) return;
      
      const currentY = e.touches[0].clientY;
      const windowHeight = window.innerHeight;
      
      // If swipe started in bottom 20% of screen and moved up by at least 30px
      if (touchStartY.current > windowHeight * 0.8) {
        if (touchStartY.current - currentY > 30) {
          setIsVisible(true);
          startHideTimer();
        }
      }
    };

    const handleTouchEnd = () => {
      touchStartY.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isVisible]);

  const handleNavClick = (id: typeof navItems[number]['id']) => {
    onNavigate(id);
    setIsVisible(false);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  };

  return (
    <>
      {/* Subtle indicator hint at the bottom edge */}
      <div 
        className={`fixed bottom-1 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full z-40 transition-opacity duration-500 ${isVisible ? 'opacity-0' : 'opacity-100'}`}
      />

      <div 
        className={`fixed bottom-6 w-full px-6 z-50 pointer-events-none flex justify-center transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0'}`}
        onMouseEnter={startHideTimer}
        onTouchStart={(e) => { e.stopPropagation(); startHideTimer(); }}
      >
        <div className="pointer-events-auto flex justify-between items-center w-full max-w-sm px-4 py-3 glass-panel-heavy rounded-2xl shadow-2xl">
          {navItems.map((item) => {
            const isActive = currentScreen === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className="relative flex flex-col items-center justify-center gap-1.5 min-w-[64px] group"
              >
                <div className={`p-2.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-[#AFDDFF]/10 shadow-[0_0_15px_rgba(175,221,255,0.15)]' : 'hover:bg-white/5'}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#AFDDFF]' : 'text-white/40 group-hover:text-white/80'}`} />
                </div>
                <span className={`text-[9px] font-tech uppercase tracking-widest transition-colors ${isActive ? 'text-[#AFDDFF]' : 'text-white/30'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute -top-3 w-8 h-[2px] bg-[#AFDDFF] rounded-b-full shadow-[0_2px_8px_rgba(175,221,255,0.8)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
