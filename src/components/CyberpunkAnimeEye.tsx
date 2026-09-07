/**
 * Cyberpunk Anime Neon Eye Dynamic Background Component
 * 
 * Features:
 * 1. Background Image Integration:
 *    - Uses uploaded Anime Eye image (Direct CDN: https://i.ibb.co/kVtwpRN9/anime-eye.jpg with local fallback /anime-eye.jpg)
 *    - Position: Absolute centered (object-cover object-center)
 *    - Opacity: Exactly 50% (opacity: 0.5)
 *    - Layering: z-index: 0, pointer-events: none
 * 2. Reactive Pupil & Blink Animation (Seen Status):
 *    - UNREAD STATE:
 *      * Original deep Crimson/Ruby Red tone (#ff0055)
 *      * Breathing neon pulse glow over pupil area
 *    - SEEN STATE TRANSITION:
 *      * Quick eyelid blink animation (scaleY: 1 -> 0 -> 1 over 260ms)
 *      * Dynamic CSS hue-rotate and neon overlay filter shifting red to Electric Emerald Neon Green (#00ff88)
 *      * Holographic green ripple wave on state change
 * 3. 60 FPS mobile performance with GPU-accelerated CSS keyframes.
 */

import React, { useState, useEffect, useRef } from 'react';

interface CyberpunkAnimeEyeProps {
  /** True when the latest outgoing message is seen (read) by partner */
  isSeen: boolean;
  /** Unique ID or timestamp of the latest outgoing message to trigger blink transitions */
  messageStatusKey?: string;
  className?: string;
}

const PRIMARY_IMAGE_URL = 'https://i.ibb.co/kVtwpRN9/anime-eye.jpg';
const FALLBACK_IMAGE_URL = '/anime-eye.jpg';

export const CyberpunkAnimeEye: React.FC<CyberpunkAnimeEyeProps> = ({
  isSeen,
  messageStatusKey,
  className = '',
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [showRipple, setShowRipple] = useState(false);
  const [imgSrc, setImgSrc] = useState(PRIMARY_IMAGE_URL);
  const prevIsSeenRef = useRef<boolean>(isSeen);

  // Trigger eyelid blink and ripple wave when status transitions from unread to seen
  useEffect(() => {
    if (isSeen && !prevIsSeenRef.current) {
      setIsBlinking(true);
      setShowRipple(true);

      const blinkTimeout = setTimeout(() => {
        setIsBlinking(false);
      }, 260);

      const rippleTimeout = setTimeout(() => {
        setShowRipple(false);
      }, 1000);

      prevIsSeenRef.current = isSeen;
      return () => {
        clearTimeout(blinkTimeout);
        clearTimeout(rippleTimeout);
      };
    }

    prevIsSeenRef.current = isSeen;
  }, [isSeen, messageStatusKey]);

  // Dynamic filter for image:
  // - Unread: Natural deep crimson/ruby red tones with subtle red neon bloom
  // - Seen: 135deg hue-rotate shifts #ff0055 directly to #00ff88 (Electric Emerald Neon Green)
  const imageFilterStyle = isSeen
    ? 'hue-rotate(135deg) saturate(1.4) brightness(1.06) drop-shadow(0 0 24px rgba(0, 255, 136, 0.45))'
    : 'saturate(1.2) brightness(1.02) drop-shadow(0 0 20px rgba(255, 0, 85, 0.4))';

  return (
    <div
      id="cyberpunk-anime-eye-bg"
      className={`absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0 ${className}`}
      aria-hidden="true"
    >
      {/* Centered Eyelid Blink Wrapper */}
      <div
        className={`relative w-full h-full flex items-center justify-center transition-transform duration-300 ${
          isBlinking ? 'animate-eye-blink' : ''
        }`}
        style={{ transformOrigin: 'center center' }}
      >
        {/* 1. Uploaded Anime Eye Background Image with exactly 50% opacity */}
        <img
          src={imgSrc}
          alt=""
          loading="eager"
          decoding="async"
          onError={() => {
            if (imgSrc !== FALLBACK_IMAGE_URL) {
              setImgSrc(FALLBACK_IMAGE_URL);
            }
          }}
          className="absolute inset-0 w-full h-full object-cover object-center transition-all duration-700 ease-out"
          style={{
            opacity: 0.5,
            filter: imageFilterStyle,
          }}
        />

        {/* 2. Reactive Neon Pupil Aura Overlay */}
        <div
          className={`absolute w-44 h-44 sm:w-56 sm:h-56 rounded-full blur-2xl pointer-events-none transition-all duration-700 ${
            isSeen ? 'animate-neon-green' : 'animate-neon-red'
          }`}
          style={{
            background: isSeen
              ? 'radial-gradient(circle, rgba(0, 255, 136, 0.45) 0%, rgba(0, 255, 136, 0.12) 45%, rgba(0, 255, 136, 0) 75%)'
              : 'radial-gradient(circle, rgba(255, 0, 85, 0.4) 0%, rgba(255, 0, 85, 0.1) 45%, rgba(255, 0, 85, 0) 75%)',
          }}
        />

        {/* 3. Futuristic Holographic HUD Overlay & Expanding Ripple on Seen */}
        <svg
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-80 h-80 sm:w-96 sm:h-96 max-w-[85vw] max-h-[85vh] relative pointer-events-none z-10 transition-colors duration-700"
        >
          {/* Subtle Rotating Tech Reticle */}
          <g className="animate-hud-spin" style={{ transformOrigin: '200px 200px' }}>
            <circle
              cx="200"
              cy="200"
              r="78"
              stroke={isSeen ? '#00ff88' : '#ff0055'}
              strokeWidth="1.2"
              strokeOpacity="0.45"
              strokeDasharray="16 12 4 12"
            />
            <circle
              cx="200"
              cy="200"
              r="92"
              stroke={isSeen ? '#00ff88' : '#ff0055'}
              strokeWidth="0.8"
              strokeOpacity="0.25"
              strokeDasharray="4 14"
            />
          </g>

          <g className="animate-hud-spin-reverse" style={{ transformOrigin: '200px 200px' }}>
            <circle
              cx="200"
              cy="200"
              r="58"
              stroke={isSeen ? '#00ff88' : '#ff0055'}
              strokeWidth="1.2"
              strokeOpacity="0.5"
              strokeDasharray="24 16 6 16"
            />
          </g>

          {/* Central Target Calibrations */}
          <line
            x1="130"
            y1="200"
            x2="270"
            y2="200"
            stroke={isSeen ? '#00ff88' : '#ff0055'}
            strokeWidth="0.75"
            strokeOpacity="0.3"
            strokeDasharray="3 4"
          />
          <line
            x1="200"
            y1="130"
            x2="200"
            y2="270"
            stroke={isSeen ? '#00ff88' : '#ff0055'}
            strokeWidth="0.75"
            strokeOpacity="0.3"
            strokeDasharray="3 4"
          />

          {/* Expanding Green Ripple Wave on Seen Transition */}
          {showRipple && (
            <circle
              cx="200"
              cy="200"
              className="animate-ripple-pulse"
              stroke="#00ff88"
              strokeWidth="2.5"
              fill="none"
              style={{ transformOrigin: '200px 200px' }}
            />
          )}
        </svg>

        {/* 4. Vignette Shadow to smoothly blend into #07090e background edges */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 35%, rgba(7, 9, 14, 0.4) 65%, #07090e 98%)',
          }}
        />
      </div>
    </div>
  );
};
