import React from 'react';
import { Home, MessageCircle, BarChart2, User } from 'lucide-react';
import { AppScreen } from '../types';

interface BottomNavigationProps {
  currentScreen: AppScreen;
  onNavigate: (screen: 'mood' | 'inbox' | 'profile' | 'weekly_report') => void;
}

export function BottomNavigation({ currentScreen, onNavigate }: BottomNavigationProps) {
  const isDark = currentScreen === 'inbox';
  const bgClass = isDark ? 'bg-[#0f121a]/95 border-white/10' : 'bg-white/90 border-gray-100';
  const inactiveIconColor = isDark ? 'text-slate-400' : 'text-gray-600';
  const inactiveTextColor = isDark ? 'text-slate-400' : 'text-gray-600';

  return (
    <div className={`fixed bottom-0 w-full backdrop-blur-xl border-t pt-3 pb-8 px-6 z-50 ${bgClass} transition-colors duration-300`}>
      <div className="flex justify-between items-center max-w-md mx-auto">
        {/* Item 1 */}
        <div 
          onClick={() => onNavigate('mood')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-opacity ${currentScreen === 'mood' ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}
        >
          <Home className={`w-6 h-6 ${currentScreen === 'mood' ? 'text-[#4a8bf5]' : inactiveIconColor}`} />
          <span className={`text-[10px] font-medium ${currentScreen === 'mood' ? 'text-[#4a8bf5]' : inactiveTextColor}`}>home</span>
        </div>
        
        {/* Item 2 */}
        <div 
          onClick={() => onNavigate('inbox')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-opacity ${currentScreen === 'inbox' ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}
        >
          <MessageCircle className={`w-6 h-6 ${currentScreen === 'inbox' ? 'text-[#4a8bf5]' : inactiveIconColor}`} />
          <span className={`text-[10px] font-medium uppercase ${currentScreen === 'inbox' ? 'text-[#4a8bf5]' : inactiveTextColor}`}>CHAT</span>
        </div>
        
        {/* Item 3 */}
        <div 
          onClick={() => onNavigate('weekly_report')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-opacity ${currentScreen === 'weekly_report' ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}
        >
          <BarChart2 className={`w-6 h-6 ${currentScreen === 'weekly_report' ? 'text-[#4a8bf5]' : inactiveIconColor}`} />
          <span className={`text-[10px] font-medium ${currentScreen === 'weekly_report' ? 'text-[#4a8bf5]' : inactiveTextColor}`}>weekly report</span>
        </div>
        
        {/* Item 4 */}
        <div 
          onClick={() => onNavigate('profile')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-opacity ${currentScreen === 'profile' ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}
        >
          <User className={`w-6 h-6 ${currentScreen === 'profile' ? 'text-[#4a8bf5]' : inactiveIconColor}`} />
          <span className={`text-[10px] font-medium ${currentScreen === 'profile' ? 'text-[#4a8bf5]' : inactiveTextColor}`}>profile</span>
        </div>
      </div>
    </div>
  );
}
