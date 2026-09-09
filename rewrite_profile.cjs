const fs = require('fs');
const code = `import React, { useState, useEffect } from 'react';
import { UserRecord } from '../types';
import { updateUserProfile, saveGoalProgress, getWeeklyGoalProgress, getFriendCount, getGoalStats } from '../services/appService';
import { clearCurrentSession, updateUserPresence } from '../userService';
import { LogOut, Edit3, Flame, Users, BookOpen, Target, Activity, Check } from 'lucide-react';
import { motion } from 'motion/react';

interface ProfileScreenProps {
  currentUser: UserRecord;
  onLogout: () => void;
}

export function ProfileScreen({ currentUser, onLogout }: ProfileScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit form state
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [personalGoal, setPersonalGoal] = useState(currentUser.personalGoal || '');
  const [saving, setSaving] = useState(false);
  
  // Stats & Progress state
  const [goalProgress, setGoalProgress] = useState<Record<string, boolean>>({});
  const [friendCount, setFriendCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [thirtyDayCount, setThirtyDayCount] = useState(0);
  
  const todayDateStr = new Date().toISOString().split('T')[0];
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i)); // From 6 days ago up to today
    return d.toISOString().split('T')[0];
  });

  const loadData = async () => {
    const [progress, count, stats] = await Promise.all([
      getWeeklyGoalProgress(currentUser.username, dates),
      getFriendCount(currentUser.username),
      getGoalStats(currentUser.username)
    ]);
    setGoalProgress(progress);
    setFriendCount(count);
    setStreak(stats.streak);
    setThirtyDayCount(stats.thirtyDayCount);
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleSaveProfile = async () => {
    setSaving(true);
    await updateUserProfile(currentUser.username, { 
      fullName, 
      bio, 
      personalGoal,
      streak, // Update current streak on user record so friends can see
      thirtyDayProgress: thirtyDayCount
    });
    
    setIsEditing(false);
    setSaving(false);
  };

  const toggleGoalProgress = async (dateStr: string) => {
    // Only allow completing up to today, not future
    if (dateStr > todayDateStr) return;
    
    const newVal = !goalProgress[dateStr];
    setGoalProgress(prev => ({ ...prev, [dateStr]: newVal }));
    
    await saveGoalProgress(currentUser.username, dateStr, newVal);
    await loadData(); // Reload stats after toggle
  };

  const handleLogout = async () => {
    try {
      await updateUserPresence(currentUser.username, false);
    } catch {
      // ignore
    }
    clearCurrentSession();
    onLogout();
  };

  return (
    <div className="w-full min-h-[100dvh] text-white flex flex-col items-center relative overflow-x-hidden pb-32 bg-transparent">
      
      {/* Background Technical Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0 flex flex-col justify-between p-4 opacity-20">
        <div className="text-[10px] font-tech text-[#AFDDFF] leading-relaxed mt-16">
          <div>// USER_NODE_ACTIVE</div>
          <div>// PRIVATE_PROFILE</div>
        </div>
      </div>

      {/* Header Bar */}
      <header className="w-full max-w-2xl px-6 py-4 glass-panel border-b-0 border-x-0 border-t-0 rounded-none flex items-center justify-between z-20 shrink-0 sticky top-0">
        <div>
          <h1 className="text-lg font-display font-bold tracking-widest uppercase">
            MY PROFILE
          </h1>
          <div className="text-[10px] font-tech text-[#AFDDFF] uppercase tracking-[0.2em] mt-0.5">
            // STATUS_ONLINE
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="px-3 py-1.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-slate-900 font-tech text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5"
        >
          <LogOut className="w-3 h-3" />
          Logout
        </button>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-2xl px-6 py-6 flex flex-col gap-6 flex-1 z-10">
        
        {/* Profile Card */}
        <div className="glass-panel-heavy p-6 rounded-2xl border border-white/5 flex items-center gap-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#AFDDFF]/10 rounded-full blur-[40px] pointer-events-none -mr-10 -mt-10" />
          
          <div className="w-20 h-20 rounded-full border-2 border-[#AFDDFF]/30 bg-black flex items-center justify-center overflow-hidden shrink-0 shadow-[0_0_15px_rgba(175,221,255,0.1)]">
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover filter grayscale" />
            ) : (
              <span className="text-2xl font-tech text-white/50">{currentUser.fullName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input 
                type="text" 
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full bg-black/40 border border-[#AFDDFF]/50 rounded px-2 py-1 text-white font-display font-bold text-xl uppercase mb-1 focus:outline-none"
              />
            ) : (
              <h2 className="text-xl font-display font-bold text-white uppercase tracking-wide truncate">{currentUser.fullName}</h2>
            )}
            <p className="text-[11px] font-tech text-[#AFDDFF] uppercase tracking-widest truncate">@{currentUser.username}</p>
          </div>
          
          <button 
            onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
            disabled={saving}
            className="p-2 rounded-full glass-panel text-[#AFDDFF] hover:bg-[#AFDDFF] hover:text-black transition-colors shrink-0"
          >
            {isEditing ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-panel p-4 rounded-xl flex flex-col items-center gap-2 border-white/5 relative overflow-hidden">
             <div className="absolute inset-0 bg-[#AFDDFF]/5 tech-grid opacity-30 pointer-events-none" />
             <Users className="w-5 h-5 text-[#AFDDFF] z-10" />
             <div className="text-2xl font-display font-bold text-white z-10">{friendCount}</div>
             <div className="text-[9px] font-tech text-white/40 uppercase tracking-widest z-10">Friends</div>
          </div>
          <div className="glass-panel p-4 rounded-xl flex flex-col items-center gap-2 border-white/5 relative overflow-hidden">
             <div className="absolute inset-0 bg-[#FF3366]/5 tech-grid opacity-30 pointer-events-none" />
             <Flame className="w-5 h-5 text-[#FF3366] z-10" />
             <div className="text-2xl font-display font-bold text-white z-10">{streak}</div>
             <div className="text-[9px] font-tech text-white/40 uppercase tracking-widest z-10">Day Streak</div>
          </div>
        </div>

        {/* Bio Section */}
        <div className="glass-panel-heavy p-5 rounded-xl border border-white/5 flex flex-col gap-3">
          <h3 className="text-[10px] font-tech text-[#AFDDFF]/60 uppercase tracking-widest flex items-center gap-2">
            <BookOpen className="w-3 h-3" /> Bio / About Me
          </h3>
          {isEditing ? (
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Write something about yourself..."
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-[#AFDDFF]/50 min-h-[80px]"
            />
          ) : (
            <p className="text-sm text-white/80 leading-relaxed font-sans">{bio || 'No bio provided yet.'}</p>
          )}
        </div>

        {/* Goal Section */}
        <div className="glass-panel-heavy p-5 rounded-xl border border-white/5 flex flex-col gap-5">
          <div>
            <h3 className="text-[10px] font-tech text-[#00E5FF]/60 uppercase tracking-widest flex items-center gap-2 mb-2">
              <Target className="w-3 h-3" /> Personal Goal
            </h3>
            {isEditing ? (
              <input
                type="text"
                value={personalGoal}
                onChange={e => setPersonalGoal(e.target.value)}
                placeholder="e.g. मैं रोज़ 2 घंटे पढ़ूँगा"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00E5FF]/50"
              />
            ) : (
              <p className="text-sm text-white/90 leading-relaxed font-sans">{personalGoal || 'No goal set yet.'}</p>
            )}
          </div>

          <div className="w-full h-px bg-white/5" />
          
          {/* 7-Day Tracker */}
          <div>
            <h3 className="text-[9px] font-tech text-white/40 uppercase tracking-widest mb-4">
              // 7-DAY TRACKER
            </h3>
            <div className="flex justify-between items-center w-full">
              {dates.map((dateStr, i) => {
                const isCompleted = goalProgress[dateStr];
                const isFuture = dateStr > todayDateStr;
                return (
                  <div key={dateStr} className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => toggleGoalProgress(dateStr)}
                      disabled={isFuture}
                      className={\`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 relative \${
                        isCompleted 
                          ? 'bg-black border border-[#00E5FF] shadow-[inset_0_0_15px_rgba(0,229,255,0.4),0_0_10px_rgba(0,229,255,0.2)]' 
                          : isFuture
                          ? 'bg-white/5 border border-white/5 opacity-30 cursor-not-allowed'
                          : 'bg-black border border-white/20 hover:border-white/40'
                      }\`}
                    >
                      {isCompleted && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-4 h-4 rounded-full bg-[#00E5FF] shadow-[0_0_10px_#00E5FF]" />
                      )}
                    </button>
                    <span className="text-[8px] font-tech text-white/50">Day {i + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="w-full h-px bg-white/5" />

          {/* 30-Day Progress */}
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-tech text-[#E024C5]/60 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-3 h-3" /> 30-Day Progress
            </h3>
            <div className="text-lg font-display font-bold text-white tracking-widest">
              {thirtyDayCount} <span className="text-[10px] text-white/40 font-tech">/ 30 DAYS</span>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
`;
fs.writeFileSync('src/components/ProfileScreen.tsx', code);
