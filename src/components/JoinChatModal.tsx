/**
 * PIN Chat - Screen 5: Join Chat Modal / View
 * Package: com.aistudio.pinchat.kpmd
 * 
 * Features:
 * - 6-character alphanumeric PIN input (auto-uppercase, max length 6)
 * - "Join" button disabled until exactly 6 characters are typed
 * - UI Error States placeholder: toggleable test triggers for "Chat not found" & "Room full"
 * - "Cancel / Close" button cleanly returning to Home Screen
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, X, AlertTriangle, Users, Loader2 } from 'lucide-react';
import { UserProfile } from '../types';
import { verifyRoom, joinExistingRoom } from '../roomService';

interface JoinChatModalProps {
  user: Partial<UserProfile>;
  onJoin: (pin: string) => void;
  onClose: () => void;
}

export const JoinChatModal: React.FC<JoinChatModalProps> = ({
  user,
  onJoin,
  onClose,
}) => {
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRoomFull, setIsRoomFull] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isPinComplete = pin.trim().length === 6;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only alphanumeric, uppercase, max length 6
    const clean = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    setPin(clean);
    if (errorMessage) setErrorMessage(null);
    if (isRoomFull) setIsRoomFull(false);
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPinComplete || isLoading) return;

    setErrorMessage(null);
    setIsRoomFull(false);
    setIsLoading(true);

    try {
      const cleanPin = pin.trim().toUpperCase();
      // Strict database / state verification: do NOT automatically create room
      const result = await verifyRoom(cleanPin, user.uid);

      if (!result.exists) {
        setIsLoading(false);
        setErrorMessage(result.error || 'Invalid PIN or Room Not Found');
        return;
      }

      if (result.isFull) {
        setIsLoading(false);
        setIsRoomFull(true);
        setErrorMessage(result.error || 'Room full (2/2 members active).');
        return;
      }

      // Valid existing room found with available slot
      const joinResult = await joinExistingRoom(cleanPin, user);
      setIsLoading(false);

      if (!joinResult.success) {
        setErrorMessage(joinResult.error || 'Invalid PIN or Room Not Found');
        return;
      }

      // Enter verified room
      onJoin(cleanPin);
    } catch (err) {
      setIsLoading(false);
      console.error('[PIN Chat] Error during room verification:', err);
      setErrorMessage('Invalid PIN or Room Not Found');
    }
  };

  return (
    <div
      id="join-chat-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 15 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm bg-[#0f121a] border border-white/10 rounded-2xl p-6 shadow-2xl relative text-center flex flex-col items-center"
      >
        {/* Close Button */}
        <button
          id="closeJoinModalBtn"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          title="Cancel and close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Icon */}
        <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-3 text-amber-400">
          <LogIn className="w-6 h-6" />
        </div>

        <h3 className="text-xl font-bold text-white mb-1">
          Join Private Chat
        </h3>
        <p className="text-xs text-slate-400 mb-5">
          Enter the 6-character room PIN provided by the creator.
        </p>

        {/* Form */}
        <form onSubmit={handleJoinSubmit} className="w-full flex flex-col items-center">
          {/* PIN Input with Character Counter */}
          <div className="w-full mb-4">
            <div className="relative">
              <input
                id="joinPinInput"
                type="text"
                value={pin}
                onChange={handleInputChange}
                placeholder="ENTER PIN"
                autoFocus
                maxLength={6}
                className="w-full py-3.5 px-4 bg-[#161b26] border border-white/10 focus:border-amber-500/80 focus:ring-2 focus:ring-amber-500/25 rounded-xl text-center text-2xl font-mono font-extrabold tracking-[0.3em] uppercase text-amber-300 placeholder:text-slate-600 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm focus:outline-none transition-all pl-[0.3em]"
              />
            </div>

            {/* Character Indicator */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1.5 px-1">
              <span>Alphanumeric (6 chars)</span>
              <span className={isPinComplete ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {pin.length} / 6
              </span>
            </div>
          </div>

          {/* Real Database Error States Display */}
          <AnimatePresence mode="wait">
            {errorMessage && (
              <motion.div
                key="err-message"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                id="errorPinValidation"
                className={`w-full mb-4 p-3.5 rounded-xl border text-xs flex items-center gap-2.5 text-left ${
                  isRoomFull
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {isRoomFull ? (
                  <Users className="w-4 h-4 shrink-0 text-amber-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <div>
                  <div className="font-bold">{errorMessage}</div>
                  <div className="text-[11px] opacity-80 mt-0.5">
                    {isRoomFull
                      ? 'Maximum 2 participants allowed per private PIN room.'
                      : 'Please check with the host or verify the 6-character code.'}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Join Action Button */}
          <button
            id="submitJoinBtn"
            type="submit"
            disabled={!isPinComplete || isLoading}
            className={`w-full py-3 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 mb-2 ${
              isPinComplete && !isLoading
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 cursor-pointer active:scale-[0.98]'
                : 'bg-white/[0.05] text-slate-500 border border-white/[0.05] cursor-not-allowed opacity-60'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Checking room...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Join Room</span>
              </>
            )}
          </button>

          {/* Cancel Button */}
          <button
            id="cancelJoinModalBtn"
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </form>
      </motion.div>
    </div>
  );
};
