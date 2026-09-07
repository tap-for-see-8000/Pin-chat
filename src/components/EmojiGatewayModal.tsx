/**
 * PIN Chat - Secret Emoji Gateway Modal
 * Package: com.aistudio.pinchat.kpmd
 * 
 * Features:
 * - First-time setup: Select & confirm 1 secret pass-emoji for a contact
 * - Subsequent visits: "Verify Emoji to Open Chat"
 * - Correct emoji: Silently opens authentic Firestore 1-on-1 private chat
 * - Wrong emoji: NEVER shows error; silently opens realistic Decoy (Amazon/Zomato/Courier) chat!
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  KeyRound,
  Lock,
  Sparkles,
  X,
  Check,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { PublicUserProfile } from '../types';
import { getChatPassEmoji, setChatPassEmoji } from '../userService';

interface EmojiGatewayModalProps {
  isOpen: boolean;
  targetUser: PublicUserProfile;
  chatId: string;
  currentUsername: string;
  onVerified: (isDecoy: boolean) => void;
  onClose: () => void;
}

const EMOJI_OPTIONS = [
  '🔒', '🍕', '🚀', '💎',
  '⚽', '📦', '☕', '🎮',
  '🔑', '🐱', '🍩', '🎧',
  '⚡', '🍀', '🍓', '🥑',
];

export const EmojiGatewayModal: React.FC<EmojiGatewayModalProps> = ({
  isOpen,
  targetUser,
  chatId,
  currentUsername,
  onVerified,
  onClose,
}) => {
  const [savedPassEmoji, setSavedPassEmoji] = useState<string | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [isSetupMode, setIsSetupMode] = useState(false);

  // Check if a pass-emoji has been configured for this contact
  useEffect(() => {
    if (isOpen) {
      const stored = getChatPassEmoji(currentUsername, chatId);
      setSavedPassEmoji(stored);
      setIsSetupMode(!stored);
      setSelectedEmoji(null);
    }
  }, [isOpen, currentUsername, chatId]);

  if (!isOpen) return null;

  // Handle first-time setup confirmation
  const handleSetupConfirm = () => {
    if (!selectedEmoji) return;
    setChatPassEmoji(currentUsername, chatId, selectedEmoji);
    setSavedPassEmoji(selectedEmoji);
    // Real authentic chat opens on initial setup
    onVerified(false);
  };

  // Handle emoji verification on subsequent visits
  const handleVerifyEmoji = (emoji: string) => {
    setSelectedEmoji(emoji);

    setTimeout(() => {
      if (savedPassEmoji && emoji === savedPassEmoji) {
        // Correct emoji -> authentic chat
        onVerified(false);
      } else {
        // WRONG EMOJI -> NEVER show error! Silently open realistic Decoy chat!
        onVerified(true);
      }
    }, 280);
  };

  return (
    <AnimatePresence>
      <div
        id="emojiGatewayBackdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          id="emojiGatewayModal"
          className="w-full max-w-sm rounded-3xl bg-[#0f121a] border border-white/10 p-6 flex flex-col items-center text-center shadow-2xl relative overflow-hidden"
        >
          {/* Subtle ambient gradient highlight */}
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon Badge */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
            {isSetupMode ? (
              <KeyRound className="w-6 h-6" />
            ) : (
              <Lock className="w-6 h-6" />
            )}
          </div>

          {/* Title & Description */}
          {isSetupMode ? (
            <>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Set Secret Pass-Emoji
              </h2>
              <p className="text-xs text-slate-400 mt-1 mb-4 leading-relaxed max-w-xs">
                Pick a secret emoji for{' '}
                <span className="text-amber-400 font-semibold font-mono">
                  @{targetUser.username}
                </span>
                . Only tapping this exact emoji will unlock your private chat.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Verify Emoji to Open Chat
              </h2>
              <p className="text-xs text-slate-400 mt-1 mb-4 leading-relaxed max-w-xs">
                Tap the secret security emoji configured for{' '}
                <span className="text-amber-400 font-semibold font-mono">
                  @{targetUser.username}
                </span>
              </p>
            </>
          )}

          {/* Emoji Grid */}
          <div className="grid grid-cols-4 gap-2.5 w-full my-2">
            {EMOJI_OPTIONS.map((emoji) => {
              const isSelected = selectedEmoji === emoji;

              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    if (isSetupMode) {
                      setSelectedEmoji(emoji);
                    } else {
                      handleVerifyEmoji(emoji);
                    }
                  }}
                  className={`h-14 rounded-2xl text-2xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-amber-500/25 border-2 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)] scale-105'
                      : 'bg-[#161b26] border border-white/[0.08] hover:border-amber-500/40 hover:bg-[#1d2332]'
                  }`}
                  title={emoji}
                >
                  <span className="select-none filter drop-shadow">{emoji}</span>
                </button>
              );
            })}
          </div>

          {/* Action button for first-time setup mode */}
          {isSetupMode && (
            <button
              id="confirmPassEmojiBtn"
              type="button"
              disabled={!selectedEmoji}
              onClick={handleSetupConfirm}
              className="mt-4 w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>Confirm & Lock Chat ({selectedEmoji || 'None'})</span>
            </button>
          )}

          {/* Stealth Note */}
          <div className="mt-4 pt-3 border-t border-white/[0.06] w-full flex items-center justify-center gap-1.5 text-[10px] font-mono text-slate-500">
            <Shield className="w-3 h-3 text-amber-500/70" />
            <span>End-to-End Vaulted Protocol</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
