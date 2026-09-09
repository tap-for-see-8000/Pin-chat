import React, { useState, useEffect } from 'react';
import { X, Lock, Unlock, Clock, Activity, Target, Flame, Users, BookOpen, ArrowLeft } from 'lucide-react';
import { UserRecord, PublicUserProfile, SecretCapsule } from '../types';
import { getFriendCount, createSecretCapsule, getSecretCapsulesForUser, unlockSecretCapsule } from '../userService';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface ChatProfilePanelProps {
  isFriend?: boolean;
  onAddFriend?: () => void;
  onStartChat?: () => void;
  targetUser: PublicUserProfile;
  currentUser: UserRecord;
  onClose: () => void;
}

export const ChatProfilePanel: React.FC<ChatProfilePanelProps> = ({ targetUser, currentUser, onClose, isFriend, onAddFriend, onStartChat }) => {
  const [friendCount, setFriendCount] = useState(0);
  const [capsules, setCapsules] = useState<SecretCapsule[]>([]);
  const [isCreatingCapsule, setIsCreatingCapsule] = useState(false);
  const [capsuleMessage, setCapsuleMessage] = useState('');
  const [capsuleDuration, setCapsuleDuration] = useState<number>(5 * 60 * 1000);
  
  const [liveTargetUser, setLiveTargetUser] = useState<PublicUserProfile>(targetUser);

  useEffect(() => {
    getFriendCount(targetUser.username).then(setFriendCount);
  }, [targetUser.username]);

  useEffect(() => {
    if (!db) return;
    const userRef = doc(db, 'users', targetUser.username.toLowerCase());
    const unsub = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        setLiveTargetUser(prev => ({ ...prev, ...data }));
      }
    });
    return () => unsub();
  }, [targetUser.username]);

  useEffect(() => {
    if (!db) return;
    const unsub = getSecretCapsulesForUser(targetUser.username, (allCapsules) => {
      const relevant = allCapsules.filter(c => 
        (c.receiverUsername === targetUser.username && c.senderUsername === currentUser.username) ||
        (c.receiverUsername === currentUser.username && c.senderUsername === targetUser.username)
      );
      setCapsules(relevant);
    });
    return () => unsub();
  }, [targetUser.username, currentUser.username]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      capsules.forEach(c => {
        if (!c.isUnlocked && now >= c.unlockTime) {
          unlockSecretCapsule(c.id);
        }
      });
      setCapsules(prev => [...prev]);
    }, 1000);
    return () => clearInterval(interval);
  }, [capsules]);

  const handleCreateCapsule = async () => {
    if (!capsuleMessage.trim()) return;
    await createSecretCapsule({
      senderUsername: currentUser.username,
      receiverUsername: targetUser.username,
      message: capsuleMessage.trim(),
      unlockTime: Date.now() + capsuleDuration,
      createdAt: Date.now(),
    });
    setIsCreatingCapsule(false);
    setCapsuleMessage('');
  };

  const getCountdown = (unlockTime: number) => {
    const diff = unlockTime - Date.now();
    if (diff <= 0) return 'Unlocked';
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / 1000 / 60) % 60);
    const s = Math.floor((diff / 1000) % 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const streak = liveTargetUser.streak || 0;
  const thirtyDayProgress = liveTargetUser.thirtyDayProgress || 0;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-0 z-50 bg-[#000000] flex flex-col overflow-y-auto overflow-x-hidden hide-scrollbar"
    >
      <div className="sticky top-0 z-20 glass-panel border-b-0 px-4 py-4 flex items-center gap-3">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-[11px] font-tech text-[#AFDDFF]/70 uppercase tracking-widest flex-1">// USER_PROFILE</h2>
      </div>

      <div className="p-6 flex flex-col gap-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-24 h-24 rounded-full border-2 border-[#AFDDFF]/30 bg-black flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(175,221,255,0.1)]">
            {liveTargetUser.avatarUrl ? (
              <img src={liveTargetUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-tech text-white/50">{liveTargetUser.fullName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white uppercase tracking-wide">{liveTargetUser.fullName}</h1>
            <p className="text-xs font-tech text-[#AFDDFF] uppercase tracking-widest mt-1">@{liveTargetUser.username}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="glass-panel p-4 rounded-xl flex flex-col items-center gap-2 border-white/5">
            <Users className="w-5 h-5 text-[#AFDDFF]" />
            <div className="text-xl font-display font-bold text-white">{friendCount}</div>
            <div className="text-[9px] font-tech text-white/40 uppercase tracking-widest">Friends</div>
          </div>
          <div className="glass-panel p-4 rounded-xl flex flex-col items-center gap-2 border-white/5">
            <Flame className="w-5 h-5 text-[#FF3366]" />
            <div className="text-xl font-display font-bold text-white">{streak}</div>
            <div className="text-[9px] font-tech text-white/40 uppercase tracking-widest">Day Streak</div>
          </div>
        </div>

        <div className="glass-panel-heavy p-5 rounded-xl border border-white/5 flex flex-col gap-4">
          <div>
            <h3 className="text-[10px] font-tech text-[#AFDDFF]/60 uppercase tracking-widest flex items-center gap-2 mb-2">
              <BookOpen className="w-3 h-3" /> Bio
            </h3>
            <p className="text-sm text-white/80 leading-relaxed font-sans">{liveTargetUser.bio || 'No bio provided.'}</p>
          </div>
          <div className="w-full h-px bg-white/5" />
          <div>
            <h3 className="text-[10px] font-tech text-[#00E5FF]/60 uppercase tracking-widest flex items-center gap-2 mb-2">
              <Target className="w-3 h-3" /> Goal
            </h3>
            <p className="text-sm text-white/80 leading-relaxed font-sans">{liveTargetUser.personalGoal || 'No goal set.'}</p>
          </div>
          <div className="w-full h-px bg-white/5" />
          <div>
            <h3 className="text-[10px] font-tech text-white/40 uppercase tracking-widest flex items-center gap-2 mb-2">
              <Activity className="w-3 h-3" /> 30-Day Progress
            </h3>
            <div className="text-lg font-display font-bold text-white">{thirtyDayProgress} / 30 Days</div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-tech text-[#E024C5] uppercase tracking-widest flex items-center gap-2">
              <Lock className="w-3 h-3" /> Secret Capsules
            </h3>
            <button 
              onClick={() => setIsCreatingCapsule(!isCreatingCapsule)}
              className="text-[9px] font-tech bg-[#E024C5]/20 text-[#E024C5] px-2 py-1 rounded uppercase tracking-widest hover:bg-[#E024C5]/30 transition-colors"
            >
              + Create
            </button>
          </div>

          <AnimatePresence>
            {isCreatingCapsule && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="glass-panel p-4 rounded-xl border border-[#E024C5]/30 flex flex-col gap-3 overflow-hidden"
              >
                <textarea
                  value={capsuleMessage}
                  onChange={(e) => setCapsuleMessage(e.target.value)}
                  placeholder="Type a secret message..."
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm text-white font-sans placeholder-white/30 focus:outline-none focus:border-[#E024C5]/50 min-h-[80px]"
                />
                <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
                  {[
                    { label: '5m', val: 5*60*1000 },
                    { label: '1h', val: 60*60*1000 },
                    { label: '1d', val: 24*60*60*1000 },
                    { label: '2d', val: 48*60*60*1000 },
                  ].map(d => (
                    <button
                      key={d.label}
                      onClick={() => setCapsuleDuration(d.val)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-tech uppercase tracking-widest whitespace-nowrap ${
                        capsuleDuration === d.val ? 'bg-[#E024C5] text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleCreateCapsule}
                  disabled={!capsuleMessage.trim()}
                  className="w-full py-2.5 bg-[#E024C5]/80 hover:bg-[#E024C5] disabled:opacity-50 text-white font-tech text-xs uppercase tracking-widest rounded-lg transition-colors mt-1"
                >
                  Lock Capsule
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {capsules.length === 0 ? (
            <div className="text-xs text-white/30 font-sans italic text-center py-4 glass-panel rounded-xl border-white/5">
              No active capsules.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {capsules.map(capsule => {
                const isMine = capsule.senderUsername === currentUser.username;
                const isUnlocked = capsule.isUnlocked || Date.now() >= capsule.unlockTime;
                
                return (
                  <div key={capsule.id} className={`p-4 rounded-xl border ${isUnlocked ? 'glass-panel border-white/10' : 'glass-panel-heavy border-[#E024C5]/20'} flex flex-col gap-2 relative overflow-hidden`}>
                    {!isUnlocked && (
                      <div className="absolute top-0 right-0 w-16 h-16 bg-[#E024C5]/10 rounded-full blur-xl pointer-events-none -mr-4 -mt-4" />
                    )}
                    <div className="flex items-center justify-between z-10">
                      <span className="text-[9px] font-tech text-[#E024C5] uppercase tracking-widest flex items-center gap-1.5">
                        {isUnlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {isMine ? 'Sent Capsule' : 'Received Capsule'}
                      </span>
                      {!isUnlocked && (
                        <span className="text-[10px] font-tech text-white/80 uppercase tracking-widest flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#E024C5]" /> {getCountdown(capsule.unlockTime)}
                        </span>
                      )}
                    </div>
                    <div className="z-10 mt-1">
                      {isUnlocked ? (
                        <p className="text-sm text-white font-sans whitespace-pre-wrap">{capsule.message}</p>
                      ) : (
                        <p className="text-sm text-white/40 font-sans italic select-none blur-[2px]">
                          Someone left a secret for you.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
