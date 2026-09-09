import React, { useEffect, useState } from 'react';
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

  return (
    <div className="min-h-screen w-full bg-[#f8fbff] flex flex-col font-sans relative overflow-hidden pb-24 text-slate-800">
      <div className="flex-1 overflow-y-auto w-full max-w-md mx-auto p-6">
        <h1 className="text-2xl font-bold text-center mt-8 mb-2 text-[#2d3748]">Weekly Report</h1>
        <p className="text-center text-gray-500 mb-8 text-sm">Your mood history over the last 7 days</p>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4a8bf5]" />
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-50">
            <div className="flex flex-col gap-4">
              <MoodStatRow emoji="😊" label="Happy" count={counts.happy} color="bg-[#e6f7ed]" textColor="text-[#2f6f4a]" />
              <MoodStatRow emoji="😕" label="Sad" count={counts.sad} color="bg-[#e8f1ff]" textColor="text-[#2b5492]" />
              <MoodStatRow emoji="😔" label="Low" count={counts.low} color="bg-[#ffeaf2]" textColor="text-[#9d365a]" />
              <MoodStatRow emoji="😠" label="Angry" count={counts.angry} color="bg-[#fff0e5]" textColor="text-[#a0522d]" />
              <MoodStatRow emoji="🫂" label="Missing Anyone" count={counts['missing anyone']} color="bg-[#f2eafc]" textColor="text-[#5a3a8a]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MoodStatRow({ emoji, label, count, color, textColor }: { emoji: string; label: string; count: number; color: string; textColor: string }) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-2xl ${color}`}>
      <div className="flex items-center gap-4">
        <span className="text-2xl">{emoji}</span>
        <span className={`font-medium ${textColor}`}>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-bold text-lg ${textColor}`}>{count}</span>
        <span className={`text-xs opacity-70 ${textColor}`}>days</span>
      </div>
    </div>
  );
}
