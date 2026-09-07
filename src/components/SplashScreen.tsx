/**
 * PIN Chat - Screen 1: Splash / Welcome Screen
 * Package: com.aistudio.pinchat.kpmd
 * 
 * 1. Centered glowing flower bud SVG/CSS animation that blooms.
 * 2. Branding: "Created by Mohit".
 * 3. Text heading: "What's your name?"
 * 4. Active input field: <input id="userNameInput" placeholder="Enter your name..." />
 * 5. Action button: <button id="continueBtn">Continue</button>
 * 6. Click & Logic: Extract first name (e.g., "Rahul Yadav" -> "RAHUL"),
 *    display bold greeting "WELCOME RAHUL", and transition to Screen 2.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Sparkles } from 'lucide-react';

interface SplashScreenProps {
  onComplete: (fullName: string, firstName: string) => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [fullName, setFullName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = fullName.trim();
    if (!trimmed) {
      setError('Please enter your name to continue');
      return;
    }
    setError('');
    
    // Extract first name and uppercase it (e.g. "Rahul Yadav" -> "RAHUL")
    const extractedFirstName = trimmed.split(/\s+/)[0].toUpperCase();
    setFirstName(extractedFirstName);
    setIsSubmitted(true);

    // Automatically trigger transition to Screen 2
    setTimeout(() => {
      onComplete(trimmed, extractedFirstName);
    }, 1600);
  };

  return (
    <div
      id="splash-screen"
      className="relative w-full min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden select-none"
    >
      {/* Cinematic Ambient Glow */}
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.3, 0.45, 0.3],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute w-96 h-96 rounded-full bg-gradient-to-tr from-amber-500/20 to-orange-500/10 blur-[90px] pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1.1, 1, 1.1],
          opacity: [0.15, 0.3, 0.15],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -bottom-10 w-80 h-80 rounded-full bg-gradient-to-br from-indigo-600/20 to-purple-600/10 blur-[80px] pointer-events-none"
      />

      {/* Center Container */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center text-center">
        <AnimatePresence mode="wait">
          {!isSubmitted ? (
            <motion.div
              key="prompt-state"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="w-full flex flex-col items-center"
            >
              {/* Centered Glowing Flower Bud SVG/CSS Animation that blooms */}
              <div
                id="blooming-flower"
                className="relative w-36 h-36 flex items-center justify-center mb-5"
              >
                {/* Ambient Halo Behind Flower */}
                <motion.div
                  animate={{
                    scale: [0.95, 1.25, 0.95],
                    opacity: [0.4, 0.8, 0.4],
                  }}
                  transition={{
                    duration: 3.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="absolute inset-0 rounded-full bg-amber-500/25 blur-xl"
                />

                {/* Animated Blooming Flower Petals (SVG) */}
                <svg
                  viewBox="0 0 100 100"
                  className="w-32 h-32 text-amber-400 drop-shadow-[0_0_18px_rgba(245,158,11,0.55)]"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Glowing Center Pistil */}
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="8"
                    className="fill-amber-400"
                    animate={{ scale: [0.9, 1.15, 0.9] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  />

                  {/* 8 Outer Blooming Petals */}
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, index) => (
                    <motion.path
                      key={`outer-${angle}`}
                      d="M 50 50 C 40 30, 40 14, 50 8 C 60 14, 60 30, 50 50 Z"
                      fill="url(#flowerPetalGrad)"
                      stroke="rgba(245, 158, 11, 0.55)"
                      strokeWidth="0.8"
                      style={{
                        originX: '50px',
                        originY: '50px',
                        rotate: angle,
                      }}
                      animate={{
                        scale: [0.8, 1.05, 0.8],
                        opacity: [0.85, 1, 0.85],
                        rotate: [angle, angle + 6, angle],
                      }}
                      transition={{
                        duration: 3.8,
                        repeat: Infinity,
                        delay: index * 0.12,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}

                  {/* 8 Inner Budding Petals */}
                  {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((angle, index) => (
                    <motion.path
                      key={`inner-${angle}`}
                      d="M 50 50 C 44 36, 44 22, 50 18 C 56 22, 56 36, 50 50 Z"
                      fill="rgba(251, 191, 36, 0.85)"
                      stroke="rgba(254, 243, 199, 0.8)"
                      strokeWidth="0.5"
                      style={{
                        originX: '50px',
                        originY: '50px',
                        rotate: angle,
                      }}
                      animate={{
                        scale: [0.7, 0.95, 0.7],
                        opacity: [0.75, 1, 0.75],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        delay: 0.2 + index * 0.1,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}

                  <defs>
                    <linearGradient id="flowerPetalGrad" x1="50" y1="8" x2="50" y2="50" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#fef08a" stopOpacity="0.95" />
                      <stop offset="0.6" stopColor="#f59e0b" stopOpacity="0.8" />
                      <stop offset="1" stopColor="#b45309" stopOpacity="0.3" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Branding: Created by Mohit */}
              <div className="mb-6">
                <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">
                  PIN Chat
                </h1>
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 font-mono">
                  Created by Mohit
                </p>
              </div>

              {/* Interactive Name Form Card */}
              <form
                onSubmit={handleSubmit}
                id="splash-name-form"
                className="w-full bg-[#0f121a]/95 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-2xl flex flex-col gap-4 text-left"
              >
                <div>
                  <label
                    htmlFor="userNameInput"
                    className="block text-sm font-semibold text-slate-200 mb-2"
                  >
                    What's your name?
                  </label>
                  <input
                    id="userNameInput"
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Enter your name..."
                    autoFocus
                    maxLength={40}
                    className="w-full px-4 py-3 bg-[#161b26] border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25 transition-all"
                  />
                  {error && (
                    <p className="text-xs text-rose-400 mt-1.5 font-medium">{error}</p>
                  )}
                </div>

                <button
                  id="continueBtn"
                  type="submit"
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          ) : (
            /* Animated Greeting: WELCOME [FIRST_NAME] */
            <motion.div
              key="welcome-greeting"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              id="welcomeGreetingContainer"
              className="flex flex-col items-center"
            >
              <motion.div
                animate={{
                  rotate: [0, 180, 360],
                  scale: [1, 1.15, 1],
                }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-6 shadow-[0_0_35px_rgba(245,158,11,0.35)]"
              >
                <Sparkles className="w-10 h-10 text-amber-400" />
              </motion.div>

              <div className="text-center">
                <span className="text-xs font-mono uppercase tracking-widest text-amber-400/90 mb-2 block font-semibold">
                  Identity Registered
                </span>
                <h2
                  id="welcomeGreetingText"
                  className="text-3xl font-extrabold text-white tracking-tight uppercase"
                >
                  WELCOME {firstName}
                </h2>
                <p className="text-xs text-slate-400 mt-2 font-mono">
                  Loading secure profile setup...
                </p>
              </div>

              <div className="mt-8 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Branding Guarantee */}
      <div className="absolute bottom-6 text-[11px] text-slate-500 font-mono tracking-wider">
        PIN CHAT &bull; CREATED BY MOHIT
      </div>
    </div>
  );
};
