/**
 * PIN Chat - Screen 4: Create Chat Modal / View
 * Package: com.aistudio.pinchat.kpmd
 * 
 * Features:
 * - 6-character PIN display in bold monospace (JetBrains Mono)
 * - "Copy PIN" with clipboard writing and visual confirmation
 * - "Share PIN" with navigator.share or fallback
 * - "Enter Room" button navigating to chat
 * - "Cancel" button returning to Home Screen
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Copy, Check, Share2, ArrowRight, X, Shield, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { UserProfile } from '../types';
import { generateUniquePin, registerNewRoom } from '../roomService';

interface CreateChatModalProps {
  user: Partial<UserProfile>;
  onEnterRoom: (pin: string) => void;
  onClose: () => void;
}

export const CreateChatModal: React.FC<CreateChatModalProps> = ({
  user,
  onEnterRoom,
  onClose,
}) => {
  const [pin, setPin] = useState(() => generateUniquePin());
  const [isRegistering, setIsRegistering] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // Auto-register the generated PIN on creation
  useEffect(() => {
    registerNewRoom(pin, user);
  }, [pin, user]);

  const handleRegeneratePin = () => {
    const newPin = generateUniquePin();
    setPin(newPin);
    setCopied(false);
    setShareFeedback(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'PIN Chat Room Invite',
      text: `Join my private 1-on-1 PIN Chat room with code: ${pin}`,
      url: window.location.href,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        setShareFeedback('Shared!');
        setTimeout(() => setShareFeedback(null), 2000);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopy();
          setShareFeedback('PIN Copied to clipboard!');
          setTimeout(() => setShareFeedback(null), 2000);
        }
      }
    } else {
      handleCopy();
      setShareFeedback('PIN Copied to clipboard!');
      setTimeout(() => setShareFeedback(null), 2000);
    }
  };

  const handleEnterClick = async () => {
    setIsRegistering(true);
    await registerNewRoom(pin, user);
    setIsRegistering(false);
    onEnterRoom(pin);
  };

  return (
    <div
      id="create-chat-modal-backdrop"
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
        {/* Top Close Button */}
        <button
          id="closeCreateModalBtn"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          title="Cancel and close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Icon */}
        <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-3 text-amber-400">
          <Sparkles className="w-6 h-6" />
        </div>

        <h3 className="text-xl font-bold text-white mb-1">
          Create New Room
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Generated a unique 6-character PIN. Share with your partner to join.
        </p>

        {/* 6-Character Monospace PIN Display */}
        <div
          id="pinDisplayBlock"
          className="w-full py-4 px-6 rounded-xl bg-[#161b26] border border-amber-500/40 shadow-[0_0_25px_rgba(245,158,11,0.15)] flex flex-col items-center justify-center mb-3 relative group"
        >
          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400/80 mb-1">
            OFFICIAL ROOM PIN
          </span>
          <span
            id="roomPinValue"
            className="text-3xl font-extrabold font-mono tracking-[0.25em] text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)] pl-[0.25em]"
          >
            {pin}
          </span>
        </div>

        {/* Regenerate PIN action */}
        <button
          type="button"
          id="regeneratePinBtn"
          onClick={handleRegeneratePin}
          className="text-[11px] font-mono text-slate-400 hover:text-amber-300 flex items-center gap-1.5 mb-4 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Generate different PIN</span>
        </button>

        {/* Action Buttons: Copy PIN & Share PIN */}
        <div className="w-full grid grid-cols-2 gap-2.5 mb-5">
          <button
            id="copyPinBtn"
            type="button"
            onClick={handleCopy}
            className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              copied
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-200 hover:border-amber-500/30'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-amber-400" />
                <span>Copy PIN</span>
              </>
            )}
          </button>

          <button
            id="sharePinBtn"
            type="button"
            onClick={handleShare}
            className="py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-amber-500/30 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Share PIN</span>
          </button>
        </div>

        {/* Share notification toast if triggered */}
        {shareFeedback && (
          <div className="text-xs text-amber-300 font-mono mb-3 animate-fade-in">
            {shareFeedback}
          </div>
        )}

        {/* Strict 1-on-1 Notice */}
        <div className="w-full p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] mb-5 flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <Shield className="w-3.5 h-3.5 text-amber-400" />
          <span>Strictly 2 members allowed in this room</span>
        </div>

        {/* Action Button: Enter Room */}
        <button
          id="enterCreatedRoomBtn"
          type="button"
          disabled={isRegistering}
          onClick={handleEnterClick}
          className="w-full py-3.5 px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer active:scale-[0.98] mb-2"
        >
          {isRegistering ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              <span>Registering room...</span>
            </>
          ) : (
            <>
              <span>Enter Room</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Cancel Button */}
        <button
          id="cancelCreateModalBtn"
          type="button"
          onClick={onClose}
          className="w-full py-2.5 px-4 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </motion.div>
    </div>
  );
};
