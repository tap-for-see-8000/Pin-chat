import React from 'react';
import { Home, MessageCircle, BarChart2, User } from 'lucide-react';
import { AppScreen } from '../types';

interface BottomNavigationProps {
  currentScreen: AppScreen;
  onNavigate: (screen: 'mood' | 'inbox' | 'profile' | 'weekly_report') => void;
}

export function BottomNavigation({ currentScreen, onNavigate }: BottomNavigationProps) {
  const navItems = [
    { id: 'mood', icon: Home, label: 'CMD' },
    { id: 'inbox', icon: MessageCircle, label: 'COMMS' },
    { id: 'weekly_report', icon: BarChart2, label: 'DATA' },
    { id: 'profile', icon: User, label: 'ID' }
  ] as const;

  return (
    <div className="fixed bottom-6 w-full px-6 z-50 pointer-events-none flex justify-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
      <div className="pointer-events-auto flex justify-between items-center w-full max-w-sm px-4 py-3 glass-panel-heavy rounded-2xl transition-all duration-300">
        {navItems.map((item) => {
          const isActive = currentScreen === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
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
  );
}
