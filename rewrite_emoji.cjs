const fs = require('fs');
const code = `import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import { Shield, Lock, X } from 'lucide-react';
import { PublicUserProfile } from '../types';

interface EmojiGatewayModalProps {
  isOpen: boolean;
  targetUser: PublicUserProfile;
  chatId: string;
  currentUsername: string;
  onVerified: (isDecoy: boolean) => void;
  onClose: () => void;
}

export const EmojiGatewayModal: React.FC<EmojiGatewayModalProps> = ({
  isOpen,
  targetUser,
  chatId,
  currentUsername,
  onVerified,
  onClose,
}) => {
  const [isVerifying, setIsVerifying] = useState(false);

  const handleDragEnd = (event: any, info: any, emojiId: string) => {
    const { offset } = info;
    const threshold = 60; // minimum drag distance

    if (Math.abs(offset.y) > Math.abs(offset.x)) {
      // Vertical drag
      if (offset.y > threshold) {
        // Dragged Down -> REAL CHAT
        triggerVerification(false);
      } else if (offset.y < -threshold) {
        // Dragged Up -> FAKE CHAT
        triggerVerification(true);
      }
    } else {
      // Horizontal drag
      if (Math.abs(offset.x) > threshold) {
        // Dragged towards the other emoji or side -> FAKE CHAT
        triggerVerification(true);
      }
    }
  };

  const triggerVerification = (isDecoy: boolean) => {
    setIsVerifying(true);
    setTimeout(() => {
      onVerified(isDecoy);
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-none touch-none">
        
        {/* Background Technical Elements */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 opacity-30">
          <div className="text-[9px] font-tech text-[#AFDDFF] uppercase tracking-[0.2em]">
            <div>// SECURE_NODE_ACTIVE</div>
            <div>// AWAITING_AUTHORIZATION</div>
          </div>
          <div className="text-[9px] font-tech text-[#AFDDFF] text-right uppercase tracking-[0.2em]">
            <div>ENCRYPTED_CHANNEL //</div>
            <div>{chatId} //</div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-sm rounded-3xl glass-panel-heavy border border-white/5 p-8 flex flex-col items-center relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]"
        >
          {/* Subtle background grid */}
          <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-white/40 hover:text-white transition-colors z-20"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-[#AFDDFF] mb-6 shadow-inner z-10 border border-[#AFDDFF]/20">
            <Shield className="w-6 h-6" />
          </div>

          <div className="text-center z-10 w-full mb-12">
            <h2 className="text-sm font-tech text-white uppercase tracking-[0.2em] mb-2">
              // AUTH_REQUIRED
            </h2>
            <div className="h-px w-1/2 bg-gradient-to-r from-transparent via-[#AFDDFF]/30 to-transparent mx-auto" />
          </div>

          {/* Interactive Emojis Area */}
          <div className="flex items-center justify-center gap-12 w-full z-20 h-40 relative">
            
            {/* Downward Trail Indicator (Static background hint) */}
            <div className="absolute left-1/2 top-full -translate-x-1/2 -mt-10 h-24 w-1 bg-gradient-to-b from-transparent via-[#AFDDFF]/10 to-transparent pointer-events-none" />

            {/* Emoji 1: Smiling Face */}
            <motion.div
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.8}
              onDragEnd={(e, info) => handleDragEnd(e, info, 'smile')}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 1.2, cursor: 'grabbing' }}
              className="relative cursor-grab flex items-center justify-center w-20 h-20 group"
            >
              <div className="absolute inset-0 bg-[#00E5FF]/20 rounded-full blur-xl group-hover:bg-[#00E5FF]/40 transition-colors" />
              <div className="text-6xl filter drop-shadow-[0_0_15px_rgba(0,229,255,0.8)] relative z-10">
                😄
              </div>
            </motion.div>

            {/* Emoji 2: Mask/Mysterious */}
            <motion.div
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.8}
              onDragEnd={(e, info) => handleDragEnd(e, info, 'mask')}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 1.2, cursor: 'grabbing' }}
              className="relative cursor-grab flex items-center justify-center w-20 h-20 group"
            >
              <div className="absolute inset-0 bg-[#8B5CF6]/20 rounded-full blur-xl group-hover:bg-[#8B5CF6]/40 transition-colors" />
              <div className="text-6xl filter drop-shadow-[0_0_15px_rgba(139,92,246,0.8)] relative z-10">
                🎭
              </div>
            </motion.div>

          </div>

          <div className="mt-12 text-[10px] font-tech text-white/30 uppercase tracking-[0.2em] z-10 text-center flex flex-col gap-1">
            <span>GESTURE_AUTHORIZATION</span>
            <span className="text-[#AFDDFF]/40">PENDING_INPUT</span>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
`;
fs.writeFileSync('src/components/EmojiGatewayModal.tsx', code);
