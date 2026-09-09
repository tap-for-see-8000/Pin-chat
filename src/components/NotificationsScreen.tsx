import React, { useState, useEffect } from 'react';
import { UserRecord, AppNotification } from '../types';
import { getNotifications, markNotificationAsHandled } from '../services/appService';
import { Bell, ArrowLeft, Check, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface NotificationsScreenProps {
  currentUser: UserRecord;
  onBack: () => void;
}

export function NotificationsScreen({ currentUser, onBack }: NotificationsScreenProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifs();
  }, [currentUser]);

  const loadNotifs = async () => {
    const notifs = await getNotifications(currentUser.username);
    setNotifications(notifs);
    setLoading(false);
  };

  const handleMarkAsRead = async (notifId: string) => {
    await markNotificationAsHandled(notifId);
    await loadNotifs();
  };

  const getTimeString = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full min-h-[100dvh] text-white flex flex-col bg-transparent relative overflow-hidden pb-20">
      <header className="w-full px-4 py-4 glass-panel border-b-0 border-x-0 border-t-0 rounded-none flex items-center gap-3 z-20 shrink-0 sticky top-0">
        <button 
          onClick={onBack}
          className="p-2 rounded-md glass-panel-heavy text-white/60 hover:text-white transition-colors active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-display font-bold tracking-widest uppercase flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#AFDDFF]" /> NOTIFICATIONS
          </h1>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-3 overflow-y-auto z-10">
        {loading ? (
          <div className="text-center text-white/40 text-xs font-tech animate-pulse py-10">// SCANNING_LOGS</div>
        ) : notifications.length === 0 ? (
          <div className="text-center text-white/40 text-xs font-tech py-10 glass-panel rounded-xl">// SYSTEM_CLEAN : NO_NEW_ACTIVITY</div>
        ) : (
          notifications.map(notif => (
            <motion.div 
              key={notif.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel-heavy p-4 rounded-xl border border-[#AFDDFF]/20 flex items-center justify-between gap-4 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-[#AFDDFF]" />
              <div className="flex-1">
                <p className="text-sm text-slate-200 font-sans leading-relaxed">
                  {notif.type === 'friend_added' ? (
                    <><span className="font-bold text-white uppercase tracking-wider">@{notif.senderUsername}</span> ने आपको Friends में add किया।</>
                  ) : notif.type === 'new_message' ? (
                    <><span className="font-bold text-white uppercase tracking-wider">@{notif.senderUsername}</span> ने आपको message किया।</>
                  ) : (
                    <><span className="font-bold text-white uppercase tracking-wider">@{notif.senderUsername}</span> initiated activity.</>
                  )}
                </p>
                <div className="text-[10px] font-tech text-[#AFDDFF]/60 uppercase tracking-widest mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {getTimeString(notif.timestamp)}
                </div>
              </div>
              <button 
                onClick={() => handleMarkAsRead(notif.id)}
                className="p-2 rounded-full bg-[#AFDDFF]/10 text-[#AFDDFF] hover:bg-[#AFDDFF] hover:text-black transition-colors shrink-0"
              >
                <Check className="w-4 h-4" />
              </button>
            </motion.div>
          ))
        )}
      </main>
    </div>
  );
}
