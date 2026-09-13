import React, { useState, useEffect } from 'react';
import { Shield, Settings, AlertTriangle, Play, Pause, Activity, Clock, Layers, Maximize, RefreshCw, Smartphone, EyeOff, ShieldAlert, CheckCircle, ArrowRight } from 'lucide-react';
import { UserRecord } from '../types';
import { FocusTracker, FocusStats, FocusLimits } from '../plugins/FocusTrackingPlugin';
import { db, rtdb } from '../firebase';
import { ref, set, get, onValue } from 'firebase/database';
import { doc, setDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'motion/react';

interface FocusScreenProps {
  currentUser: UserRecord;
}

const DEFAULT_LIMITS: FocusLimits = {
  instagramCountLimit: 20,
  instagramTimeLimitMs: 20 * 60 * 1000,
  youtubeCountLimit: 20,
  youtubeTimeLimitMs: 20 * 60 * 1000,
  combinedCountLimit: 30,
  combinedTimeLimitMs: 30 * 60 * 1000,
  safetyDetectionEnabled: false,
  warningMode: 'warning_and_restrict',
  trackingEnabled: true
};

export const FocusScreen: React.FC<FocusScreenProps> = ({ currentUser }) => {
  const [stats, setStats] = useState<FocusStats | null>(null);
  const [limits, setLimits] = useState<FocusLimits>(DEFAULT_LIMITS);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isNative] = useState(Capacitor.isNativePlatform());
  
  const [safetyStatus, setSafetyStatus] = useState<'enabled' | 'permission_required' | 'initializing' | 'error' | 'off'>('off');
  const [safetyErrorDetail, setSafetyErrorDetail] = useState<string>('');

  const fetchStats = async () => {
    if (!isNative) return;
    try {
      const res = await FocusTracker.getStats();
      setStats(res);
      
      const safetyRes = await FocusTracker.getSafetyStatus();
      if (safetyRes) {
        setSafetyStatus(safetyRes.status as any);
        if (safetyRes.errorDetail) setSafetyErrorDetail(safetyRes.errorDetail);
      }
    } catch (err) {
      console.warn('[Focus] Failed to get stats from plugin', err);
    }
  };

  useEffect(() => {
    // Load limits from RTDB
    if (rtdb) {
      const limitsRef = ref(rtdb, 'users/' + currentUser.username.toLowerCase() + '/focus/settings');
      onValue(limitsRef, (snap) => {
        if (snap.exists()) {
          setLimits(snap.val() as FocusLimits);
          if (isNative) {
            FocusTracker.setLimits({ limits: snap.val() as FocusLimits }).catch(console.error);
          }
        }
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }

    // Polling stats from native layer
    let interval: any;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchStats();
      }
    };

    if (isNative) {
      fetchStats();
      interval = setInterval(fetchStats, 3000);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser.username, isNative]);

  const handleSaveLimits = async (newLimits: FocusLimits) => {
    setLimits(newLimits);
    if (rtdb) {
      await set(ref(rtdb, 'users/' + currentUser.username.toLowerCase() + '/focus/settings'), newLimits);
    }
    if (isNative) {
      await FocusTracker.setLimits({ limits: newLimits });
    }
  };

  const requestPermission = async (type: 'usage' | 'accessibility' | 'overlay') => {
    if (!isNative) return;
    try {
      if (type === 'usage') await FocusTracker.requestUsagePermission();
      if (type === 'accessibility') await FocusTracker.requestAccessibilityPermission();
      if (type === 'overlay') await FocusTracker.requestOverlayPermission();
    } catch (e) {
      console.error(e);
    }
  };

  const formatTime = (ms: number) => {
    const totalMins = Math.floor(ms / 60000);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  if (isLoading) {
    return <div className="w-full h-full flex items-center justify-center text-white/50 font-tech">LOADING_FOCUS_MODULE...</div>;
  }

  return (
    <div className="w-full h-[100dvh] bg-black text-white flex flex-col relative overflow-hidden pb-24">
      {/* Header */}
      <header className="px-6 pt-12 pb-4 glass-panel border-b-0 rounded-none shrink-0 relative z-10 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 uppercase tracking-widest flex items-center gap-3">
            <Shield className="w-6 h-6 text-emerald-400" /> Focus Engine
          </h1>
          <p className="text-[10px] font-tech text-white/40 uppercase tracking-[0.2em]">Android Wellbeing Layer</p>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-full glass-panel hover:bg-white/10 transition-colors">
          <Settings className="w-5 h-5 text-emerald-400" />
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {(() => {
          const needsPermissions = isNative && stats && (!stats.hasUsagePermission || !stats.hasAccessibilityPermission || !stats.hasOverlayPermission);
          if (needsPermissions) {
            return <FocusOnboarding stats={stats} requestPermission={requestPermission} onCheckStatus={fetchStats} />;
          }
          return (
            <>
        {!isNative && (
          <div className="p-4 rounded-xl glass-panel-heavy border border-amber-500/30 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
              <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest">Native App Required</h3>
            </div>
            <p className="text-xs text-white/60 font-sans leading-relaxed">
              Focus & Screen Monitoring features require native Android APIs (Accessibility Service & Usage Stats). You are currently running in the web browser. To use actual app blocking, please build the Android APK.
            </p>
            <p className="text-xs text-emerald-400/80 font-mono mt-1">
              Data syncing to RTDB is active.
            </p>
          </div>
        )}

        

{isNative && stats && (
          <div className="glass-panel-heavy p-4 rounded-2xl flex items-center justify-between border border-emerald-500/10">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl transition-colors ${limits.trackingEnabled !== false ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/40'}`}>
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-white uppercase tracking-widest">Focus Mode</span>
                <span className="text-[10px] text-white/50 font-sans">
                  {limits.trackingEnabled !== false ? 'Tracking active across apps' : 'Tracking paused'}
                </span>
              </div>
            </div>
            <button 
              onClick={() => handleSaveLimits({...limits, trackingEnabled: limits.trackingEnabled === false ? true : false})}
              className={`w-12 h-6 rounded-full p-1 transition-colors flex items-center shrink-0 ${limits.trackingEnabled !== false ? 'bg-emerald-500' : 'bg-white/20'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${limits.trackingEnabled !== false ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        )}

                {/* Dashboards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Instagram */}
          <div className="glass-panel p-4 rounded-2xl flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-rose-500/10 blur-[20px] rounded-full pointer-events-none" />
            <h3 className="text-xs font-bold text-rose-400 uppercase tracking-widest flex items-center gap-2">
              <Smartphone className="w-4 h-4" /> IG Reels
            </h3>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/50 uppercase font-tech">Count</span>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-display font-bold text-white">{stats?.instagramCount || 0}</span>
                <span className="text-xs text-white/40 mb-1">/ {limits.instagramCountLimit}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/50 uppercase font-tech">Time</span>
              <div className="flex items-end gap-1">
                <span className="text-lg font-display font-bold text-white">{formatTime(stats?.instagramTimeMs || 0)}</span>
                <span className="text-[10px] text-white/40 mb-1">/ {formatTime(limits.instagramTimeLimitMs)}</span>
              </div>
            </div>
          </div>

          {/* YouTube Shorts */}
          <div className="glass-panel p-4 rounded-2xl flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-red-500/10 blur-[20px] rounded-full pointer-events-none" />
            <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
              <Play className="w-4 h-4" /> YT Shorts
            </h3>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/50 uppercase font-tech">Count</span>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-display font-bold text-white">{stats?.youtubeCount || 0}</span>
                <span className="text-xs text-white/40 mb-1">/ {limits.youtubeCountLimit}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/50 uppercase font-tech">Time</span>
              <div className="flex items-end gap-1">
                <span className="text-lg font-display font-bold text-white">{formatTime(stats?.youtubeTimeMs || 0)}</span>
                <span className="text-[10px] text-white/40 mb-1">/ {formatTime(limits.youtubeTimeLimitMs)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Combined & Safety */}
        <div className="glass-panel-heavy p-4 rounded-2xl border border-white/5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-emerald-400" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white uppercase tracking-widest">Combined Limits</span>
                <span className="text-[10px] text-white/50 font-tech">Short-form aggregate</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-emerald-400">{formatTime(stats?.totalTimeMs || 0)}</div>
              <div className="text-[9px] text-white/40 uppercase">/ {formatTime(limits.combinedTimeLimitMs)}</div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className={`w-5 h-5 ${limits.safetyDetectionEnabled ? 'text-indigo-400' : 'text-white/20'}`} />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white uppercase tracking-widest">Nudity Safety Shield</span>
                <span className="text-[10px] text-white/50 font-tech">On-device content analysis</span>
              </div>
            </div>
            <div className="text-xs font-bold font-tech uppercase">
              {limits.safetyDetectionEnabled ? <span className="text-amber-400">MODEL PENDING</span> : <span className="text-white/20">OFF</span>}
            </div>
          </div>
        
        {limits.safetyDetectionEnabled && safetyStatus === 'error' && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 mt-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">Scanner Offline</span>
              <p className="text-[10px] font-sans text-rose-200/80 leading-relaxed">
                {safetyErrorDetail || "Model weights missing."}
              </p>
            </div>
          </div>
        )}
        </div>
        
        {/* Statistics insights */}
        <div className="glass-panel p-4 rounded-2xl border border-emerald-500/10 mb-8">
           <h3 className="text-[10px] font-tech text-emerald-400/60 uppercase tracking-[0.1em] mb-2 flex items-center gap-2">
             <BarChart2 className="w-3 h-3" /> Usage Insights
           </h3>
           <p className="text-xs text-white/70 leading-relaxed font-sans">
             {(stats?.instagramTimeMs || 0) > (stats?.youtubeTimeMs || 0) 
               ? "You spend most of your short-form time on Instagram Reels. Consider setting a stricter daily limit." 
               : (stats?.youtubeTimeMs || 0) > 0 
                 ? "You spend most of your short-form time on YouTube Shorts." 
                 : "Your focus limits are well-maintained today. No heavy short-form usage detected."}
           </p>
        </div>

            </>
          );
        })()}
      </div>

      {/* Settings Modal overlay */}
      <AnimatePresence>
        {showSettings && (
          <SettingsPanel limits={limits} onSave={handleSaveLimits} onClose={() => setShowSettings(false)} safetyStatus={safetyStatus} safetyErrorDetail={safetyErrorDetail} isNative={isNative} fetchSafetyStatus={fetchStats} />
        )}
      </AnimatePresence>
    </div>
  );
};

// Simplified BarChart2 mock since it's not imported directly in the component above
const BarChart2 = ({className}: {className?: string}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
)

const SettingsPanel = ({ limits, onSave, onClose, safetyStatus, safetyErrorDetail, isNative, fetchSafetyStatus }: { limits: FocusLimits, onSave: (l: FocusLimits) => Promise<void>, onClose: () => void, safetyStatus: string, safetyErrorDetail: string, isNative: boolean, fetchSafetyStatus: () => void }) => {
  const [local, setLocal] = useState<FocusLimits>(limits);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      await onSave(local);
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      className="absolute inset-0 z-50 bg-[#0a0a0a] flex flex-col"
    >
      <header className="px-6 py-5 glass-panel border-b-0 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Focus Configuration</h2>
        <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white">
          <EyeOff className="w-5 h-5" />
        </button>
      </header>
      
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 pb-32">
        {/* Count Limits */}
        <div className="flex flex-col gap-4">
          <h3 className="text-[10px] font-tech text-white/40 uppercase tracking-widest border-b border-white/10 pb-2">Daily Session Counts</h3>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/70">IG Reels Count Limit</label>
            <input type="number" value={local.instagramCountLimit} onChange={e => setLocal({...local, instagramCountLimit: parseInt(e.target.value)||0})} className="w-full bg-white/5 border border-white/10 p-3 rounded-lg text-white" />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/70">YT Shorts Count Limit</label>
            <input type="number" value={local.youtubeCountLimit} onChange={e => setLocal({...local, youtubeCountLimit: parseInt(e.target.value)||0})} className="w-full bg-white/5 border border-white/10 p-3 rounded-lg text-white" />
          </div>
        </div>

        {/* Time Limits */}
        <div className="flex flex-col gap-4">
          <h3 className="text-[10px] font-tech text-white/40 uppercase tracking-widest border-b border-white/10 pb-2">Daily Time Limits (Minutes)</h3>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/70">IG Reels Time (mins)</label>
            <input type="number" value={Math.floor(local.instagramTimeLimitMs / 60000)} onChange={e => setLocal({...local, instagramTimeLimitMs: (parseInt(e.target.value)||0)*60000})} className="w-full bg-white/5 border border-white/10 p-3 rounded-lg text-white" />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/70">YT Shorts Time (mins)</label>
            <input type="number" value={Math.floor(local.youtubeTimeLimitMs / 60000)} onChange={e => setLocal({...local, youtubeTimeLimitMs: (parseInt(e.target.value)||0)*60000})} className="w-full bg-white/5 border border-white/10 p-3 rounded-lg text-white" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-emerald-400/80 font-bold">Combined Limit (mins)</label>
            <input type="number" value={Math.floor(local.combinedTimeLimitMs / 60000)} onChange={e => setLocal({...local, combinedTimeLimitMs: (parseInt(e.target.value)||0)*60000})} className="w-full bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg text-emerald-100" />
          </div>
        </div>

        {/* Safety */}
        <div className="flex flex-col gap-4">
          <h3 className="text-[10px] font-tech text-white/40 uppercase tracking-widest border-b border-white/10 pb-2">Screen Safety</h3>
          
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 cursor-pointer" onClick={async (e) => {
              e.preventDefault();
              const newState = !local.safetyDetectionEnabled;
              setLocal({...local, safetyDetectionEnabled: newState});
              
              if (isNative) {
                if (newState) {
                  // Attempt to enable
                  const res = await FocusTracker.setSafetyFilterEnabled({ enabled: true });
                  if (res && res.status === 'permission_required') {
                    // Turn it back off locally since permission is missing
                    setLocal({...local, safetyDetectionEnabled: false});
                  }
                } else {
                  await FocusTracker.setSafetyFilterEnabled({ enabled: false });
                }
                setTimeout(fetchSafetyStatus, 500);
              }
            }}>
              <div className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors ${local.safetyDetectionEnabled ? 'bg-indigo-500' : 'bg-white/20'}`}>
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${local.safetyDetectionEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-xs text-white/80">Enable On-Device Nudity/Explicit Filter</span>
            </label>

            {/* Status Indicator */}
            {isNative && (
              <div className="flex flex-col gap-2 mt-2">
                {safetyStatus === 'permission_required' && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-amber-400">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-widest">Permission Required</span>
                    </div>
                    <p className="text-[10px] text-amber-200/80 leading-relaxed font-sans">
                      Screen Safety requires Accessibility permission to analyze the screen for explicit content.
                    </p>
                    <button 
                      onClick={(e) => { e.preventDefault(); FocusTracker.requestSafetyPermission(); }}
                      className="mt-1 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors"
                    >
                      Enable Permission
                    </button>
                  </div>
                )}
                
                {safetyStatus === 'initializing' && (
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-2 text-indigo-400">
                    <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-widest">Initializing Scanner...</span>
                  </div>
                )}
                
                {safetyStatus === 'error' && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-rose-400">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-widest">Initialization Failed</span>
                    </div>
                    <p className="text-[10px] text-rose-200/80 leading-relaxed font-sans">
                      {safetyErrorDetail || "The ML model failed to initialize."}
                    </p>
                  </div>
                )}
                
                {safetyStatus === 'active' && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400">
                    <Shield className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-widest">Scanner Active</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="shrink-0 p-4 pb-8 glass-panel border-t border-white/10 flex items-center gap-3 bg-[#0a0a0a]/90 backdrop-blur-xl">
        <button 
          onClick={onClose}
          className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white/70 font-bold uppercase tracking-widest text-xs rounded-xl transition-colors active:scale-95"
          disabled={isSaving || isSuccess}
        >
          Cancel
        </button>
        <button 
          onClick={handleSaveClick}
          className={`flex-[2] py-3.5 font-bold uppercase tracking-widest text-xs rounded-xl transition-all active:scale-95 flex justify-center items-center gap-2 ${
            isSuccess 
              ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
              : 'bg-[#10b981] hover:bg-emerald-400 text-black'
          }`}
          disabled={isSaving || isSuccess}
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
            </span>
          ) : isSuccess ? (
            <span className="flex items-center gap-2">
              Saved
            </span>
          ) : (
            'Save Settings'
          )}
        </button>
      </div>
    </motion.div>
  );
}

const FocusOnboarding = ({ stats, requestPermission, onCheckStatus }: { stats: FocusStats, requestPermission: (type: 'usage' | 'accessibility' | 'overlay') => void, onCheckStatus: () => void }) => {
  return (
    <div className="flex flex-col gap-6 items-center justify-center pt-8 pb-12 h-full">
      <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-2">
        <ShieldAlert className="w-8 h-8 text-indigo-400" />
      </div>
      
      <div className="text-center px-4">
        <h2 className="text-lg font-bold text-white mb-2 font-display">Setup Required</h2>
        <p className="text-xs text-white/60 leading-relaxed font-sans max-w-[280px] mx-auto">
          Focus mode needs special Android permissions to track your usage and apply limits when you exceed them.
        </p>
      </div>

      <div className="w-full flex flex-col gap-3 mt-4">
        {/* Usage Access */}
        <div className={`p-4 rounded-2xl border flex flex-col gap-3 transition-colors ${stats.hasUsagePermission ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full mt-0.5 ${stats.hasUsagePermission ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/40'}`}>
              {stats.hasUsagePermission ? <CheckCircle className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white mb-1">Usage Access</h3>
              <p className="text-[10px] text-white/60 leading-relaxed">
                Needed to calculate the time you spend inside apps like Instagram and YouTube.
              </p>
            </div>
          </div>
          {!stats.hasUsagePermission && (
            <button onClick={() => requestPermission('usage')} className="mt-2 w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl transition-colors">
              Grant Permission
            </button>
          )}
        </div>

        {/* Accessibility Service */}
        <div className={`p-4 rounded-2xl border flex flex-col gap-3 transition-colors ${stats.hasAccessibilityPermission ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full mt-0.5 ${stats.hasAccessibilityPermission ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/40'}`}>
              {stats.hasAccessibilityPermission ? <CheckCircle className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white mb-1">Accessibility Service</h3>
              <p className="text-[10px] text-white/60 leading-relaxed">
                Crucial to specifically detect "Reels" and "Shorts" instead of normal video watching, and to enforce blocking.
              </p>
            </div>
          </div>
          {!stats.hasAccessibilityPermission && (
            <button onClick={() => requestPermission('accessibility')} className="mt-2 w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl transition-colors">
              Enable Service
            </button>
          )}
        </div>

        {/* Display Over Other Apps */}
        <div className={`p-4 rounded-2xl border flex flex-col gap-3 transition-colors ${stats.hasOverlayPermission ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full mt-0.5 ${stats.hasOverlayPermission ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/40'}`}>
              {stats.hasOverlayPermission ? <CheckCircle className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white mb-1">Display Over Other Apps</h3>
              <p className="text-[10px] text-white/60 leading-relaxed">
                Needed to show the blocking screen when your daily limit is reached.
              </p>
            </div>
          </div>
          {!stats.hasOverlayPermission && (
            <button onClick={() => requestPermission('overlay')} className="mt-2 w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl transition-colors">
              Allow Display
            </button>
          )}
        </div>
      </div>

      <button onClick={onCheckStatus} className="mt-4 flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white/70 text-xs font-bold uppercase tracking-widest rounded-full transition-colors">
        <RefreshCw className="w-4 h-4" /> Check Status
      </button>
    </div>
  );
};
