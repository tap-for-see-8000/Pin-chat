import React, { useState, useEffect } from 'react';
import { UserRecord } from '../types';
import { updateUserProfile, saveGoalProgress, getWeeklyGoalProgress, getFriendCount } from '../services/appService';
import { clearCurrentSession, updateUserPresence } from '../userService';
import { LogOut, Edit3, CheckCircle, XCircle } from 'lucide-react';

interface ProfileScreenProps {
  currentUser: UserRecord;
  onLogout: () => void;
}

export function ProfileScreen({ currentUser, onLogout }: ProfileScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit form state
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [aboutMe, setAboutMe] = useState(currentUser.aboutMe || '');
  const [personalGoal, setPersonalGoal] = useState(currentUser.personalGoal || '');
  const [saving, setSaving] = useState(false);
  
  // Goal tracking state
  const [goalProgress, setGoalProgress] = useState<Record<string, boolean>>({});
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [friendCount, setFriendCount] = useState(0);

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i)); // From 6 days ago up to today
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    const loadData = async () => {
      const progress = await getWeeklyGoalProgress(currentUser.username, dates);
      setGoalProgress(progress);
      setLoadingProgress(false);
      
      const count = await getFriendCount(currentUser.username);
      setFriendCount(count);
    };
    loadData();
  }, [currentUser]);

  const handleSave = async () => {
    setSaving(true);
    await updateUserProfile(currentUser.username, {
      fullName,
      aboutMe,
      personalGoal
    });
    
    // Update local state by force reload or we just mutate currentUser for now
    currentUser.fullName = fullName;
    currentUser.aboutMe = aboutMe;
    currentUser.personalGoal = personalGoal;
    
    setIsEditing(false);
    setSaving(false);
  };

  const handleLogout = () => {
    updateUserPresence(currentUser.username, false);
    clearCurrentSession();
    onLogout();
  };

  const toggleGoalDay = async (date: string) => {
    const currentStatus = goalProgress[date] || false;
    const newStatus = !currentStatus;
    
    // Optimistic update
    setGoalProgress({ ...goalProgress, [date]: newStatus });
    await saveGoalProgress(currentUser.username, date, newStatus);
  };

  const completedDays = Object.values(goalProgress).filter(Boolean).length;

  return (
    <div className="min-h-screen w-full bg-[#f8fbff] flex flex-col font-sans relative overflow-hidden pb-24 text-slate-800">
      <div className="flex-1 overflow-y-auto w-full max-w-md mx-auto p-6">
        
        {/* Profile Header */}
        <div className="flex justify-between items-center mt-6 mb-8">
          <h1 className="text-2xl font-bold text-[#2d3748]">Profile</h1>
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="p-2 text-gray-500 hover:text-[#4a8bf5] bg-white rounded-full shadow-sm">
              <Edit3 className="w-5 h-5" />
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Full Name</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full mt-1 p-3 bg-gray-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-[#4a8bf5]/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">About Me</label>
              <textarea value={aboutMe} onChange={e => setAboutMe(e.target.value)} className="w-full mt-1 p-3 bg-gray-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-[#4a8bf5]/30" rows={3} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Personal Goal</label>
              <input type="text" value={personalGoal} onChange={e => setPersonalGoal(e.target.value)} placeholder="e.g. Study 2 hours a day" className="w-full mt-1 p-3 bg-gray-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-[#4a8bf5]/30" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setIsEditing(false)} className="flex-1 py-3 text-gray-600 font-semibold bg-gray-100 rounded-xl">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 text-white font-semibold bg-[#4a8bf5] rounded-xl">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        ) : (
          <>
            {/* User Info Card */}
            <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-50 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#4a8bf5] to-[#a3c4f9] flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg border-4 border-white">
                {currentUser.fullName.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-xl font-bold text-gray-800">{currentUser.fullName}</h2>
              <p className="text-sm text-gray-500 mt-1">@{currentUser.username}</p>
              
              <div className="flex gap-6 mt-6 w-full justify-center border-t border-gray-100 pt-6">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-gray-800">{friendCount}</span>
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Friends</span>
                </div>
              </div>

              {currentUser.aboutMe && (
                <div className="mt-6 w-full text-center">
                  <p className="text-sm text-gray-600 italic">"{currentUser.aboutMe}"</p>
                </div>
              )}
            </div>

            {/* Goal Tracker */}
            {currentUser.personalGoal && (
              <div className="mt-6 bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-50">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Weekly Goal</h3>
                    <p className="text-sm text-[#4a8bf5] font-medium mt-1">{currentUser.personalGoal}</p>
                  </div>
                </div>

                {!loadingProgress && (
                  <>
                    <div className="flex justify-between items-center mb-6">
                      {dates.map((date, idx) => {
                        const isCompleted = goalProgress[date];
                        const dayLabel = new Date(date).toLocaleDateString('en-US', { weekday: 'narrow' });
                        return (
                          <div key={date} className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => toggleGoalDay(date)}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isCompleted ? 'bg-[#4a8bf5] text-white shadow-md shadow-blue-500/20' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                              {isCompleted ? <CheckCircle className="w-5 h-5" /> : <span className="text-xs font-medium">{dayLabel}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="bg-blue-50 rounded-xl p-4 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-[#2b5492] uppercase">Progress</p>
                        <p className="text-sm font-medium text-[#4a8bf5] mt-1">{completedDays} / 7 days completed</p>
                      </div>
                      <div className="text-right">
                        <button className="text-xs font-bold text-[#4a8bf5] bg-white px-3 py-1.5 rounded-lg shadow-sm">View More</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Logout Button */}
            <button 
              onClick={handleLogout}
              className="mt-8 w-full py-4 bg-red-50 text-red-500 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </>
        )}
      </div>
    </div>
  );
}