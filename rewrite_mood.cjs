const fs = require('fs');

const code = `import React, { useState, useEffect } from 'react';
import { Sparkles, Bell, Terminal } from 'lucide-react';
import { UserRecord, MoodType } from '../types';
import { saveMood } from '../services/appService';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface MoodTrackerUIProps {
  currentUser: UserRecord;
  onNavigate: (screen: 'mood' | 'inbox' | 'profile' | 'weekly_report' | 'notifications') => void;
}

export function MoodTrackerUI({ currentUser, onNavigate }: MoodTrackerUIProps) {
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, 'notifications'), 
      where('receiverUsername', '==', currentUser.username), 
      where('handled', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      setUnreadCount(snap.size);
    });
    return () => unsub();
  }, [currentUser.username]);

  const handleMoodSelect = async (mood: MoodType) => {
    setSelectedMood(mood);
    setIsSaving(true);
    const dateStr = new Date().toISOString().split('T')[0];
    await saveMood(currentUser.username, mood, dateStr);
    setIsSaving(false);
  };

  return (
    <div className="flex-1 w-full max-w-md mx-auto pt-16 pb-32 px-6 relative z-10 flex flex-col h-screen overflow-y-auto hide-scrollbar text-white">
      
      {/* Background Technical Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0 flex flex-col justify-between p-4 opacity-20">
        <div className="text-[10px] font-tech text-[#AFDDFF] leading-relaxed">
          <div>// SYSTEM MONITOR ONLINE</div>
          <div>// SECURE_NODE: ACTIVE</div>
          <div>// ENCRYPTED_CHANNEL</div>
        </div>
        <div className="text-[10px] font-tech text-[#AFDDFF] text-right leading-relaxed">
          <div>DATA_STREAM // STABLE</div>
          <div>PRIVATE_MODE // ENGAGED</div>
        </div>
      </div>

      {/* HEADER SECTION */}
      <div className="absolute top-6 right-6 z-50">
        <button 
          onClick={() => onNavigate('notifications')}
          className="relative w-11 h-11 rounded-lg glass-panel flex items-center justify-center text-white/60 hover:text-[#AFDDFF] hover:bg-white/5 transition-all border border-white/10"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#AFDDFF] rounded-full shadow-[0_0_8px_#AFDDFF] animate-pulse" />
          )}
        </button>
      </div>

      <div className="flex flex-col items-start mb-10 animate-fade-in-up w-full relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg glass-panel flex items-center justify-center text-[#AFDDFF] border border-[#AFDDFF]/30 shadow-[0_0_15px_rgba(175,221,255,0.15)]">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-[10px] text-[#AFDDFF] font-tech tracking-[0.2em] uppercase">
              // EMOTIONAL_ANALYSIS
            </h2>
            <div className="text-[9px] text-white/40 font-tech tracking-[0.2em] uppercase mt-0.5">
              USER: {currentUser.username.toUpperCase()}
            </div>
          </div>
        </div>
        
        <h1 className="text-3xl font-display font-bold leading-tight">
          System Status:<br/>
          <span className="text-white/60 text-2xl">Awaiting Input...</span>
        </h1>
      </div>

      {/* MOOD CARDS GRID */}
      <div className="flex flex-col gap-4 animate-fade-in-up relative z-10" style={{ animationDelay: '0.1s' }}>
        {[
          { id: 'happy', title: 'खुश', label: 'SECURE_NODE_01', emoji: '😄', border: 'border-[#00E5FF]/40', glow: 'shadow-[inset_0_0_20px_rgba(0,229,255,0.15)]', glowSelect: 'shadow-[inset_0_0_30px_rgba(0,229,255,0.3),0_0_20px_rgba(0,229,255,0.2)]', text: 'text-[#00E5FF]', dropShadow: 'drop-shadow-[0_0_12px_rgba(0,229,255,0.9)]' },
          { id: 'sad', title: 'उदास', label: 'SECURE_NODE_02', emoji: '😢', border: 'border-[#3B82F6]/40', glow: 'shadow-[inset_0_0_20px_rgba(59,130,246,0.15)]', glowSelect: 'shadow-[inset_0_0_30px_rgba(59,130,246,0.3),0_0_20px_rgba(59,130,246,0.2)]', text: 'text-[#3B82F6]', dropShadow: 'drop-shadow-[0_0_12px_rgba(59,130,246,0.9)]' },
          { id: 'low', title: 'मन खराब', label: 'SECURE_NODE_03', emoji: '😔', border: 'border-[#8B5CF6]/40', glow: 'shadow-[inset_0_0_20px_rgba(139,92,246,0.15)]', glowSelect: 'shadow-[inset_0_0_30px_rgba(139,92,246,0.3),0_0_20px_rgba(139,92,246,0.2)]', text: 'text-[#8B5CF6]', dropShadow: 'drop-shadow-[0_0_12px_rgba(139,92,246,0.9)]' },
          { id: 'angry', title: 'गुस्सा', label: 'SECURE_NODE_04', emoji: '😠', border: 'border-[#FF3366]/40', glow: 'shadow-[inset_0_0_20px_rgba(255,51,102,0.15)]', glowSelect: 'shadow-[inset_0_0_30px_rgba(255,51,102,0.3),0_0_20px_rgba(255,51,102,0.2)]', text: 'text-[#FF3366]', dropShadow: 'drop-shadow-[0_0_12px_rgba(255,51,102,0.9)]' },
          { id: 'missing anyone', title: 'किसी की याद आ रही है', label: 'SECURE_NODE_05', emoji: '💭', border: 'border-[#E024C5]/40', glow: 'shadow-[inset_0_0_20px_rgba(224,36,197,0.15)]', glowSelect: 'shadow-[inset_0_0_30px_rgba(224,36,197,0.3),0_0_20px_rgba(224,36,197,0.2)]', text: 'text-[#E024C5]', dropShadow: 'drop-shadow-[0_0_12px_rgba(224,36,197,0.9)]' }
        ].map((mood) => {
          const isSelected = selectedMood === mood.id;
          return (
            <button
              key={mood.id}
              onClick={() => handleMoodSelect(mood.id as MoodType)}
              className={\`relative w-full p-5 rounded-xl text-left overflow-hidden transition-all duration-300 \${
                isSelected 
                  ? \`bg-white/10 \${mood.border} \${mood.glowSelect} -translate-y-1\`
                  : \`glass-panel hover:bg-white/5 border-white/5\`
              }\`}
            >
              {/* Corner Bracket Details */}
              <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-white/20"></div>
              <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-white/20"></div>

              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className={\`w-12 h-12 flex items-center justify-center text-3xl filter transition-all duration-300 \${isSelected ? mood.dropShadow + ' scale-110' : 'drop-shadow-[0_0_5px_rgba(255,255,255,0.2)] grayscale-[0.2]'}\`}>
                    {mood.emoji}
                  </div>
                  <div className="flex flex-col">
                    <div className="font-tech text-[9px] text-white/30 uppercase tracking-[0.2em] mb-1">
                      // {mood.label}
                    </div>
                    <h3 className={\`font-sans text-xl font-bold tracking-wide transition-colors \${isSelected ? 'text-white' : 'text-white/80'}\`}>
                      {mood.title}
                    </h3>
                  </div>
                </div>
                {isSelected && (
                  <div className="flex flex-col items-end">
                    <span className={\`font-tech text-[8px] uppercase tracking-widest \${mood.text} mb-1\`}>
                      MOOD_ACTIVE
                    </span>
                    <div className={\`w-2 h-2 rounded-full \${mood.text.replace('text-', 'bg-')} shadow-[0_0_10px_currentColor] animate-pulse\`} />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/components/MoodTrackerUI.tsx', code);
