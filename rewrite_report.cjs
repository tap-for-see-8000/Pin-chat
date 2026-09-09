const fs = require('fs');

const code = `import React, { useEffect, useState } from 'react';
import { BarChart2, Terminal } from 'lucide-react';
import { UserRecord, MoodRecord } from '../types';
import { getWeeklyMoods } from '../services/appService';

interface WeeklyReportScreenProps {
  currentUser: UserRecord;
}

export function WeeklyReportScreen({ currentUser }: WeeklyReportScreenProps) {
  const [moods, setMoods] = useState<MoodRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMoods = async () => {
      // Get last 7 days including today
      const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      });

      const data = await getWeeklyMoods(currentUser.username, dates);
      setMoods(data);
      setLoading(false);
    };
    fetchMoods();
  }, [currentUser]);

  const counts = {
    happy: moods.filter(m => m.mood === 'happy').length,
    sad: moods.filter(m => m.mood === 'sad').length,
    low: moods.filter(m => m.mood === 'low').length,
    angry: moods.filter(m => m.mood === 'angry').length,
    'missing anyone': moods.filter(m => m.mood === 'missing anyone').length,
  };

  const stats = [
    { id: 'happy', emoji: '😄', label: 'खुश', count: counts.happy, text: 'text-[#00E5FF]', dropShadow: 'drop-shadow-[0_0_12px_rgba(0,229,255,0.8)]' },
    { id: 'sad', emoji: '😢', label: 'उदास', count: counts.sad, text: 'text-[#3B82F6]', dropShadow: 'drop-shadow-[0_0_12px_rgba(59,130,246,0.8)]' },
    { id: 'low', emoji: '😔', label: 'मन खराब', count: counts.low, text: 'text-[#8B5CF6]', dropShadow: 'drop-shadow-[0_0_12px_rgba(139,92,246,0.8)]' },
    { id: 'angry', emoji: '😠', label: 'गुस्सा', count: counts.angry, text: 'text-[#FF3366]', dropShadow: 'drop-shadow-[0_0_12px_rgba(255,51,102,0.8)]' },
    { id: 'missing anyone', emoji: '💭', label: 'किसी की याद आ रही है', count: counts['missing anyone'], text: 'text-[#E024C5]', dropShadow: 'drop-shadow-[0_0_12px_rgba(224,36,197,0.8)]' }
  ];

  const dominantStat = [...stats].sort((a, b) => b.count - a.count)[0];
  const hasData = dominantStat.count > 0;
  const dominantMood = {
    emoji: hasData ? dominantStat.emoji : '⚪',
    title: hasData ? dominantStat.label : 'Inactive',
    dropShadow: hasData ? dominantStat.dropShadow : '',
    text: hasData ? dominantStat.text : 'text-white/40'
  };

  return (
    <div className="w-full min-h-screen text-white select-none flex flex-col items-center relative overflow-x-hidden pb-32 bg-transparent">
      
      {/* Background Technical Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0 flex flex-col justify-between p-4 opacity-20">
        <div className="text-[10px] font-tech text-[#AFDDFF] leading-relaxed mt-16">
          <div>// WEEKLY_MOOD_ANALYSIS</div>
          <div>// 07_DAY_SCAN: COMPLETE</div>
          <div>// DATA_STREAM_STABLE</div>
        </div>
        <div className="text-[10px] font-tech text-[#AFDDFF] text-right leading-relaxed mb-32">
          <div>USER_NODE_ACTIVE //</div>
          <div>PRIVATE_ANALYSIS //</div>
        </div>
      </div>

      {/* Header Bar */}
      <header className="w-full max-w-2xl px-6 py-4 glass-panel border-b-0 border-x-0 border-t-0 rounded-none flex items-center justify-between z-20 shrink-0 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg glass-panel-heavy flex items-center justify-center text-[#AFDDFF] border border-[#AFDDFF]/30 shadow-[0_0_15px_rgba(175,221,255,0.15)]">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-display font-bold tracking-widest uppercase">
              DATA LOG
            </h1>
            <div className="text-[10px] font-tech text-[#AFDDFF] uppercase tracking-[0.2em] mt-0.5">
              // LAST_7_CYCLES
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-2xl px-6 py-6 flex flex-col gap-6 flex-1 z-10 animate-fade-in-up">
        
        {/* Hero Stat */}
        <div className="w-full p-6 rounded-xl glass-panel-heavy border border-white/5 relative overflow-hidden flex flex-col justify-center min-h-[160px]">
          {/* Subtle Background Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#AFDDFF]/5 rounded-full blur-[50px] -mr-10 -mt-10 pointer-events-none" />
          
          {/* Technical Corner Brackets */}
          <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-[#AFDDFF]/20"></div>
          <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-[#AFDDFF]/20"></div>

          <div className="relative z-10 text-center mb-6">
            <h2 className="text-[9px] font-tech uppercase tracking-[0.2em] text-white/30 mb-4">
              // DOMINANT_STATE
            </h2>
            <div className="flex flex-col items-center justify-center gap-3">
              <span className={\`text-5xl filter \${dominantMood.dropShadow}\`}>{dominantMood.emoji}</span>
              <span className={\`text-2xl font-sans font-bold \${dominantMood.text}\`}>{dominantMood.title}</span>
            </div>
            {!hasData && (
              <p className="text-xs font-tech text-white/30 mt-2 max-w-sm mx-auto uppercase tracking-widest">// NO_DATA_LOGGED</p>
            )}
          </div>
        </div>

        {/* Detailed Stats List */}
        <div className="w-full flex flex-col gap-3">
          <h2 className="text-[9px] font-tech uppercase tracking-[0.2em] text-[#AFDDFF]/50 border-b border-white/10 pb-2 mb-2">
            // STATE_DISTRIBUTION
          </h2>
          
          {stats.map((stat) => (
            <div key={stat.id} className="flex items-center justify-between p-4 rounded-lg glass-panel relative overflow-hidden group">
               {/* Technical Background Details */}
               <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
               <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white/5 group-hover:bg-white/20 transition-colors" />
               
               <div className="flex items-center gap-5 z-10">
                 <div className={\`text-3xl filter transition-all duration-300 \${stat.count > 0 ? stat.dropShadow : 'grayscale opacity-30 drop-shadow-none'}\`}>
                   {stat.emoji}
                 </div>
                 <div className="flex flex-col">
                   <span className={\`font-sans text-lg font-bold \${stat.count > 0 ? 'text-white' : 'text-white/50'}\`}>
                     {stat.label}
                   </span>
                 </div>
               </div>
               
               <div className="flex items-baseline gap-1.5 z-10 text-right">
                 <span className={\`font-display text-2xl font-bold \${stat.count > 0 ? stat.text : 'text-white/20'}\`}>
                   {stat.count}
                 </span>
                 <span className={\`font-tech text-[10px] uppercase tracking-widest \${stat.count > 0 ? 'text-white/60' : 'text-white/20'}\`}>
                   दिन
                 </span>
               </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
`;

fs.writeFileSync('src/components/WeeklyReportScreen.tsx', code);
