/**
 * PIN Chat - Landing / Home Screen
 * Package: com.aistudio.pinchat.kpmd
 * 
 * Strict Room PIN Security:
 * - Displays only two distinct actions:
 *   1. Create Room: Generates a random 6-digit PIN, creates an empty document
 *      in Firestore under rooms/{pin}, and puts the user inside.
 *   2. Join Room: Requires entering a 6-digit PIN. Checks Firestore first.
 *      If the room does not exist, displays "Invalid PIN or Room Not Found".
 *      Never auto-creates rooms on invalid PINs.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PlusCircle,
  LogIn,
  Shield,
  MessageSquare,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { UserProfile } from '../types';
import { generateUniquePin, registerNewRoom, verifyRoom, joinExistingRoom } from '../roomService';

interface HomeScreenProps {
  user: Partial<UserProfile>;
  onEnterRoom: (pin: string) => void;
  onCreateChat?: () => void;
  onJoinChat?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  user,
  onEnterRoom,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [joinPin, setJoinPin] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // 1. Create Room Action
  const handleCreateRoom = async () => {
    if (isCreating) return;
    setIsCreating(true);
    setJoinError(null);
    try {
      // Generates a random 6-digit numerical PIN
      const pin = generateUniquePin();
      // Creates empty document in Firestore under rooms/{pin} and saves to state
      await registerNewRoom(pin, user);
      // Puts the user inside
      onEnterRoom(pin);
    } catch (err) {
      console.error('[PIN Chat] Create room error:', err);
    } finally {
      setIsCreating(false);
    }
  };

  // 2. Join Room Action
  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = joinPin.trim().toUpperCase();
    if (cleanPin.length !== 6 || isJoining) {
      if (cleanPin.length !== 6) {
        setJoinError('Please enter a valid 6-digit PIN.');
      }
      return;
    }

    setJoinError(null);
    setIsJoining(true);

    try {
      // Check Firestore first. If the room does not exist, display exact message.
      const result = await verifyRoom(cleanPin, user.uid);

      if (!result.exists) {
        setIsJoining(false);
        setJoinError('Invalid PIN or Room Not Found');
        return;
      }

      if (result.isFull) {
        setIsJoining(false);
        setJoinError(result.error || 'Room full (2/2 members active).');
        return;
      }

      // Valid existing room: Join & enter
      const joinResult = await joinExistingRoom(cleanPin, user);
      if (!joinResult.success) {
        setIsJoining(false);
        setJoinError(joinResult.error || 'Invalid PIN or Room Not Found');
        return;
      }

      // Success: Put the user inside
      onEnterRoom(cleanPin);
    } catch (err) {
      console.error('[PIN Chat] Join error:', err);
      setJoinError('Invalid PIN or Room Not Found');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div
      id="home-screen"
      className="relative w-full min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden select-none bg-[#07090e]"
    >
      {/* Cinematic Ambient Glow */}
      <div className="absolute top-1/3 -left-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Home Hub Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-[#0f121a]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 flex flex-col items-center text-center"
      >
        {/* App Logo & Header */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-4 text-amber-400 shadow-inner">
          <MessageSquare className="w-7 h-7" />
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-white mb-1">
          PIN Chat
        </h1>
        <p className="text-xs font-mono font-semibold uppercase tracking-widest text-amber-400 mb-6">
          Private 1-on-1 Rooms
        </p>

        {/* User Card */}
        <div className="w-full p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] mb-6 text-left flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-0.5">
              Current User
            </span>
            <div className="text-sm font-bold text-white flex items-center gap-1.5 truncate">
              <span className="truncate">{user.displayName || 'You'}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            </div>
            {user.uid && (
              <span className="text-[10px] font-mono text-slate-500 truncate block mt-0.5">
                ID: {user.uid.slice(0, 12)}...
              </span>
            )}
          </div>
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 shrink-0">
            <Shield className="w-4 h-4" />
          </div>
        </div>

        {/* Action 1 & Action 2 Container */}
        <div className="w-full flex flex-col gap-3.5">
          {/* ACTION 1: CREATE ROOM */}
          <button
            id="createRoomBtn"
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="w-full py-4 px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-between shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-[0.98] group disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-slate-950/15">
                {isCreating ? (
                  <Loader2 className="w-4 h-4 text-slate-950 animate-spin" />
                ) : (
                  <PlusCircle className="w-4 h-4 text-slate-950" />
                )}
              </div>
              <span className="tracking-tight text-left">
                {isCreating ? 'Creating Room...' : 'Create Room'}
              </span>
            </div>
            <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-slate-950/15 uppercase">
              6-Digit PIN
            </span>
          </button>

          {/* ACTION 2: JOIN ROOM */}
          {!showJoinInput ? (
            <button
              id="joinRoomBtn"
              onClick={() => {
                setShowJoinInput(true);
                setJoinError(null);
              }}
              className="w-full py-4 px-5 bg-[#161b26] hover:bg-[#1c2230] border border-white/10 hover:border-amber-500/50 text-slate-100 font-semibold rounded-xl text-sm flex items-center justify-between transition-all cursor-pointer active:scale-[0.98] group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <LogIn className="w-4 h-4 text-amber-400" />
                </div>
                <span className="tracking-tight text-left">Join Room</span>
              </div>
              <span className="text-[10px] font-mono font-semibold text-slate-400 group-hover:text-amber-300">
                Enter PIN
              </span>
            </button>
          ) : (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleJoinSubmit}
              className="w-full bg-[#161b26] border border-amber-500/40 rounded-xl p-4 flex flex-col gap-3 text-left shadow-xl"
            >
              <div className="flex items-center justify-between">
                <label
                  htmlFor="landingJoinPinInput"
                  className="text-xs font-semibold text-amber-300 flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5 text-amber-400" />
                  <span>Enter 6-Digit Room PIN:</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowJoinInput(false);
                    setJoinError(null);
                  }}
                  className="text-slate-400 hover:text-white text-xs p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="landingJoinPinInput"
                  type="text"
                  value={joinPin}
                  onChange={(e) => {
                    const clean = e.target.value
                      .replace(/[^a-zA-Z0-9]/g, '')
                      .toUpperCase()
                      .slice(0, 6);
                    setJoinPin(clean);
                    if (joinError) setJoinError(null);
                  }}
                  maxLength={6}
                  placeholder="e.g. 482910"
                  autoFocus
                  className="flex-1 px-3.5 py-2.5 bg-[#0b0e14] border border-white/10 focus:border-amber-500 rounded-lg text-center font-mono font-bold text-base tracking-widest text-amber-300 placeholder:text-slate-600 focus:outline-none"
                />
                <button
                  id="submitJoinRoomBtn"
                  type="submit"
                  disabled={joinPin.trim().length !== 6 || isJoining}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed shadow-md"
                >
                  {isJoining ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Join</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Strict Room Error Notification */}
              {joinError && (
                <div
                  id="joinRoomErrorMessage"
                  className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-fade-in"
                >
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="font-medium leading-tight">{joinError}</span>
                </div>
              )}
            </motion.form>
          )}
        </div>

        {/* Security & Privacy Notice */}
        <div className="mt-6 flex items-center gap-2 text-[11px] text-slate-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Strict 1-on-1 private rooms. Never auto-creates on invalid PIN.</span>
        </div>
      </motion.div>

      {/* Footer Branding */}
      <div className="mt-6 text-[11px] text-slate-500 font-mono tracking-wider z-10">
        PIN CHAT &bull; STRICT ROOM SECURITY
      </div>
    </div>
  );
};
