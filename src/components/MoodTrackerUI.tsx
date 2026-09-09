import React, { useState } from 'react';
import { Home, MessageCircle, BarChart2, User, Bell } from 'lucide-react';
import { UserRecord, MoodType } from '../types';
import { saveMood } from '../services/appService';

interface MoodTrackerUIProps {
  currentUser: UserRecord;
  onNavigate: (screen: 'mood' | 'inbox' | 'profile' | 'weekly_report') => void;
}

export function MoodTrackerUI({ currentUser, onNavigate }: MoodTrackerUIProps) {
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleMoodSelect = async (mood: MoodType) => {
    setSelectedMood(mood);
    setIsSaving(true);
    const dateStr = new Date().toISOString().split('T')[0];
    await saveMood(currentUser.username, mood, dateStr);
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen w-full bg-[#f4f9ff] flex flex-col font-sans relative overflow-hidden">
      {/* Soft Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-100/50 to-transparent pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-48 -left-32 w-80 h-80 bg-purple-100/40 rounded-full blur-3xl pointer-events-none" />

      <div className="flex-1 overflow-y-auto pb-24 hide-scrollbar w-full max-w-md mx-auto relative z-10">
        
        {/* 2. TOP SECTION */}
        <div className="px-6 pt-12 pb-6 flex flex-col items-center animate-fade-in-up">
          <h2 className="text-[13px] text-slate-400 font-bold tracking-widest uppercase mb-1">
            Hello {currentUser.fullName.split(' ')[0]} aaj
          </h2>
          <h1 className="text-2xl text-slate-800 font-extrabold mt-1 text-center leading-snug drop-shadow-sm">
            हैलो यूज़र, आज आपका मूड कैसा है
          </h1>
        </div>

        {/* 3. MOOD SELECTION CARDS */}
        <div className="px-6 flex flex-col gap-3.5 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          {/* Card 1 */}
          <div 
            onClick={() => handleMoodSelect('happy')}
            className={`flex items-center p-4 rounded-3xl cursor-pointer transition-all duration-300 active:scale-95 ${
              selectedMood === 'happy' 
                ? 'bg-gradient-to-br from-emerald-100 to-emerald-50 shadow-[0_8px_30px_rgba(16,185,129,0.2)] ring-2 ring-emerald-400/50 scale-[1.02] transform' 
                : 'bg-white/70 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-white/60 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:bg-white'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${selectedMood === 'happy' ? 'bg-emerald-200/50' : 'bg-slate-50'}`}>
              😊
            </div>
            <span className={`ml-4 text-base font-bold capitalize ${selectedMood === 'happy' ? 'text-emerald-700' : 'text-slate-600'}`}>happy</span>
          </div>
            
          {/* Card 2 */}
          <div 
            onClick={() => handleMoodSelect('sad')}
            className={`flex items-center p-4 rounded-3xl cursor-pointer transition-all duration-300 active:scale-95 ${
              selectedMood === 'sad' 
                ? 'bg-gradient-to-br from-blue-100 to-blue-50 shadow-[0_8px_30px_rgba(59,130,246,0.2)] ring-2 ring-blue-400/50 scale-[1.02] transform' 
                : 'bg-white/70 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-white/60 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:bg-white'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${selectedMood === 'sad' ? 'bg-blue-200/50' : 'bg-slate-50'}`}>
              😕
            </div>
            <span className={`ml-4 text-base font-bold capitalize ${selectedMood === 'sad' ? 'text-blue-700' : 'text-slate-600'}`}>sad</span>
          </div>

          {/* Card 3 */}
          <div 
            onClick={() => handleMoodSelect('low')}
            className={`flex items-center p-4 rounded-3xl cursor-pointer transition-all duration-300 active:scale-95 ${
              selectedMood === 'low' 
                ? 'bg-gradient-to-br from-rose-100 to-rose-50 shadow-[0_8px_30px_rgba(244,63,94,0.2)] ring-2 ring-rose-400/50 scale-[1.02] transform' 
                : 'bg-white/70 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-white/60 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:bg-white'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${selectedMood === 'low' ? 'bg-rose-200/50' : 'bg-slate-50'}`}>
              😔
            </div>
            <span className={`ml-4 text-base font-bold capitalize ${selectedMood === 'low' ? 'text-rose-700' : 'text-slate-600'}`}>low</span>
          </div>

          {/* Card 4 */}
          <div 
            onClick={() => handleMoodSelect('angry')}
            className={`flex items-center p-4 rounded-3xl cursor-pointer transition-all duration-300 active:scale-95 ${
              selectedMood === 'angry' 
                ? 'bg-gradient-to-br from-orange-100 to-orange-50 shadow-[0_8px_30px_rgba(249,115,22,0.2)] ring-2 ring-orange-400/50 scale-[1.02] transform' 
                : 'bg-white/70 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-white/60 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:bg-white'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${selectedMood === 'angry' ? 'bg-orange-200/50' : 'bg-slate-50'}`}>
              😠
            </div>
            <span className={`ml-4 text-base font-bold capitalize ${selectedMood === 'angry' ? 'text-orange-700' : 'text-slate-600'}`}>angry</span>
          </div>

          {/* Card 5 */}
          <div 
            onClick={() => handleMoodSelect('missing anyone')}
            className={`flex items-center p-4 rounded-3xl cursor-pointer transition-all duration-300 active:scale-95 ${
              selectedMood === 'missing anyone' 
                ? 'bg-gradient-to-br from-purple-100 to-purple-50 shadow-[0_8px_30px_rgba(168,85,247,0.2)] ring-2 ring-purple-400/50 scale-[1.02] transform' 
                : 'bg-white/70 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-white/60 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:bg-white'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${selectedMood === 'missing anyone' ? 'bg-purple-200/50' : 'bg-slate-50'}`}>
              🫂
            </div>
            <span className={`ml-4 text-base font-bold capitalize ${selectedMood === 'missing anyone' ? 'text-purple-700' : 'text-slate-600'}`}>missing anyone</span>
          </div>
        </div>

        {/* 4. ACTION BUTTON */}
        <div className="px-6 mt-8 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <button 
            className="w-full relative group bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-bold py-4 rounded-3xl shadow-[0_10px_30px_rgba(59,130,246,0.3)] hover:shadow-[0_15px_40px_rgba(59,130,246,0.4)] active:scale-95 transition-all text-lg overflow-hidden"
            disabled={!selectedMood || isSaving}
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isSaving ? 'Saving...' : 'Rank'}
            </span>
          </button>
        </div>

        {/* 5. STREAK SECTION */}
        <div className="px-6 mt-8 pb-6 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] relative border border-white">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-slate-800">Activity Streak</span>
              <div className="p-2 bg-slate-50 rounded-full shadow-inner text-slate-400 hover:text-blue-500 transition-colors cursor-pointer">
                <Bell className="w-4 h-4" />
              </div>
            </div>
            
            <div className="mt-8 flex justify-between items-end gap-2 relative">
              {/* Block 1 */}
              <div className="w-[18%] aspect-square rounded-2xl bg-slate-100 flex items-center justify-center shadow-inner border border-slate-200/50"></div>
              
              {/* Block 2 (Active Streak) */}
              <div className="w-[22%] relative flex flex-col items-center transform -translate-y-2">
                <span className="absolute -top-7 text-[10px] text-blue-500 font-extrabold uppercase tracking-wider whitespace-nowrap drop-shadow-sm">
                  login streak day
                </span>
                <div className="w-full aspect-square rounded-2xl bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center shadow-[0_10px_20px_rgba(59,130,246,0.4)] border border-blue-400 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-white text-[11px] font-bold text-center leading-tight px-1 z-10 drop-shadow-md">
                    day flare
                  </span>
                </div>
              </div>
              
              {/* Block 3 */}
              <div className="w-[18%] aspect-square rounded-2xl bg-slate-100 flex items-center justify-center shadow-inner border border-slate-200/50"></div>
              
              {/* Block 4 */}
              <div className="w-[18%] aspect-square rounded-2xl bg-slate-100 flex items-center justify-center shadow-inner border border-slate-200/50"></div>
              
              {/* Block 5 */}
              <div className="w-[18%] aspect-square rounded-2xl bg-slate-100 flex items-center justify-center shadow-inner border border-slate-200/50"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Style for animations & scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s ease-out forwards;
          opacity: 0;
        }
      `}} />
    </div>
  );
}