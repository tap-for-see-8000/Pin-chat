/**
 * PIN Chat - Authentication & Registration Screen
 * Package: com.aistudio.pinchat.kpmd
 * 
 * Features:
 * 1. New User Registration:
 *    - Full Name (e.g. "Mohit Yadav")
 *    - 10-digit Mobile Number
 *    - Village / City (गांव / शहर)
 *    - Gender (Male / Female)
 *    - Profile Avatar with Canvas Compression & Dynamic Anime Fallback
 *    - Auto-generates credentials:
 *      * Username: [First name in lowercase] + [Last 4 digits of mobile number] (e.g. mohit8976)
 *      * Password: [First name in lowercase] + [First 4 digits of mobile number] (e.g. mohit9876)
 *    - Saves user record in Firestore under 'users/{username}'
 *    - Clearly displays generated Username and Password on screen with copy buttons
 * 2. Login Screen (Returning Users):
 *    - Username & Password inputs
 *    - Verifies credentials against Firestore 'users/{username}'
 * 3. Automatic session persistence in localStorage so page reload never logs out.
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  Shield,
  UserPlus,
  LogIn,
  Key,
  User as UserIcon,
  Phone,
  MapPin,
  Copy,
  Check,
  ArrowRight,
  AlertCircle,
  Loader2,
  Sparkles,
  Eye,
  EyeOff,
  Camera,
  Upload,
  X,
} from 'lucide-react';
import { UserRecord } from '../types';
import {
  registerNewUser,
  loginWithCredentials,
  generateCredentials,
  saveCurrentSession,
  DEFAULT_AVATARS,
} from '../userService';

interface AuthScreenProps {
  onAuthSuccess: (user: UserRecord) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');

  // Registration Form State
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [villageCity, setVillageCity] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Avatar preview resolution:
  // If custom photo is uploaded, use it. Otherwise, default to dynamic anime cyberpunk boy/girl based on gender.
  const activeAvatar = customAvatar || (gender === 'female' ? DEFAULT_AVATARS.female : DEFAULT_AVATARS.male);

  // Login Form State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Status & Feedback State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success Modal for newly registered user displaying generated credentials
  const [createdUser, setCreatedUser] = useState<UserRecord | null>(null);
  const [copiedField, setCopiedField] = useState<'username' | 'password' | 'all' | null>(null);

  // Real-time calculation of preview credentials
  const previewCreds = fullName.trim().length >= 2 && mobileNumber.replace(/\D/g, '').length >= 4
    ? generateCredentials(fullName, mobileNumber)
    : null;

  // Handle Image File Upload (Device / Gallery)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file.');
      return;
    }

    // Read and compress image to max 400x400 for fast, compact Firestore storage (~150KB or less)
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setCustomAvatar(compressed);
        } else {
          setCustomAvatar(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle Registration Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanMobile = mobileNumber.replace(/\D/g, '');

    if (fullName.trim().length < 2) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (cleanMobile.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!villageCity.trim()) {
      setErrorMessage('Please enter your village or city (गांव / शहर).');
      return;
    }

    setIsLoading(true);

    try {
      const res = await registerNewUser({
        fullName,
        mobileNumber: cleanMobile,
        villageCity,
        gender,
        avatarUrl: activeAvatar,
      });

      if (!res.success || !res.user) {
        setIsLoading(false);
        setErrorMessage(res.error || 'Registration failed. Please try again.');
        return;
      }

      // Save session immediately so refresh never logs out
      saveCurrentSession(res.user);

      // Display generated credentials modal to user
      setCreatedUser(res.user);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      console.error('[PIN Chat] Registration error:', err);
      setErrorMessage('An unexpected error occurred during registration.');
    }
  };

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!loginUsername.trim() || !loginPassword.trim()) {
      setErrorMessage('Please enter both your Username and Password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await loginWithCredentials(loginUsername, loginPassword);

      if (!res.success || !res.user) {
        setIsLoading(false);
        setErrorMessage(res.error || 'Invalid Username or Password.');
        return;
      }

      // Logged in successfully
      setIsLoading(false);
      onAuthSuccess(res.user);
    } catch (err) {
      setIsLoading(false);
      console.error('[PIN Chat] Login error:', err);
      setErrorMessage('Failed to log in. Please check your credentials.');
    }
  };

  const copyToClipboard = async (text: string, field: 'username' | 'password' | 'all') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  
  return (
    <div
      id="auth-screen"
      className="relative w-full min-h-screen flex flex-col items-center justify-center p-4 select-none bg-transparent overflow-y-auto text-white"
    >
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md glass-panel rounded-2xl p-6 sm:p-8 relative z-10 my-8 overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#AFDDFF]/5 blur-[60px] pointer-events-none" />
        
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl glass-panel-heavy flex items-center justify-center mb-4 text-[#AFDDFF]">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-white mb-2">
            PIN SYSTEM
          </h1>
          <p className="text-[11px] font-tech uppercase tracking-[0.2em] text-[#AFDDFF]/70">
            Encrypted Communication Protocol
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="w-full grid grid-cols-2 p-1 glass-panel-heavy rounded-lg mb-8 relative">
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setErrorMessage(null);
            }}
            className={`py-2.5 px-3 rounded-md text-xs font-tech uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              authMode === 'register'
                ? 'bg-[#AFDDFF] text-black shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Init Sequence</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setErrorMessage(null);
            }}
            className={`py-2.5 px-3 rounded-md text-xs font-tech uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              authMode === 'login'
                ? 'bg-[#AFDDFF] text-black shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Auth Sequence</span>
          </button>
        </div>

        {/* Error Notification Container */}
        {errorMessage && (
          <div className="mb-6 p-3 rounded-lg glass-panel-heavy border-l-2 border-[#c81b1c] text-[#c81b1c] text-xs flex items-start gap-2 animate-fade-in-up">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-tech mt-0.5">{errorMessage}</span>
          </div>
        )}

        {/* Dynamic Auth Forms */}
        <AnimatePresence mode="wait">
          {authMode === 'register' && createdUser ? (
            <motion.div
              key="credentials-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-5 w-full"
            >
              <div className="text-center mb-2">
                <div className="w-12 h-12 rounded-full glass-panel-heavy flex items-center justify-center mx-auto mb-3 border border-[#AFDDFF]/30">
                  <Check className="w-6 h-6 text-[#AFDDFF]" />
                </div>
                <h2 className="text-lg font-display font-bold text-white">Initialization Complete</h2>
                <p className="text-xs text-white/60 mt-1 font-tech">Secure your access keys below.</p>
              </div>

              <div className="p-5 glass-panel-heavy border border-[#AFDDFF]/30 rounded-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-[#AFDDFF]/5 tech-grid opacity-50 pointer-events-none" />
                <div className="flex flex-col gap-4 relative z-10">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-tech text-[#AFDDFF] uppercase tracking-widest">Username</span>
                    <div className="flex items-center justify-between bg-black/40 px-3 py-2.5 rounded border border-white/10">
                      <span className="font-tech text-white text-sm">{createdUser.username}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(createdUser.username, 'username')}
                        className="text-white/60 hover:text-[#AFDDFF] transition-colors p-1"
                      >
                        {copiedField === 'username' ? <Check className="w-4 h-4 text-[#AFDDFF]" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-tech text-[#AFDDFF] uppercase tracking-widest">Password</span>
                    <div className="flex items-center justify-between bg-black/40 px-3 py-2.5 rounded border border-white/10">
                      <span className="font-tech text-white text-sm">{createdUser.password}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(createdUser.password, 'password')}
                        className="text-white/60 hover:text-[#AFDDFF] transition-colors p-1"
                      >
                        {copiedField === 'password' ? <Check className="w-4 h-4 text-[#AFDDFF]" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => createdUser && onAuthSuccess(createdUser)}
                className="w-full py-3.5 bg-[#AFDDFF] hover:bg-white text-black font-tech font-bold uppercase tracking-wider rounded-md transition-all active:scale-95 flex items-center justify-center gap-2 mt-2"
              >
                <span>Enter System</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          ) : authMode === 'register' ? (
            <motion.div
              key="register-form"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-4 w-full"
            >
              <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4 w-full">
                {/* Image Upload */}
                <div className="flex flex-col items-center mb-2 relative">
                   <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-full glass-panel-heavy border border-white/10 flex items-center justify-center cursor-pointer group overflow-hidden relative"
                  >
                    {activeAvatar ? (
                      <img src={activeAvatar} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-6 h-6 text-white/40 group-hover:text-[#AFDDFF] transition-colors" />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <Upload className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <span className="text-[10px] font-tech text-white/40 uppercase tracking-widest mt-3">Identity Avatar (Optional)</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-tech text-white/60 uppercase tracking-widest pl-1">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="text"
                      placeholder="Enter legal name"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-md focus:border-[#AFDDFF] focus:bg-white/10 outline-none transition-all text-sm font-tech text-white placeholder-white/20"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-tech text-white/60 uppercase tracking-widest pl-1">Mobile Sequence</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="tel"
                      placeholder="10-digit identifier"
                      value={mobileNumber}
                      onChange={e => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                      maxLength={10}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-md focus:border-[#AFDDFF] focus:bg-white/10 outline-none transition-all text-sm font-tech text-white placeholder-white/20"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-tech text-white/60 uppercase tracking-widest pl-1">Sector/City</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="text"
                        placeholder="Location"
                        value={villageCity}
                        onChange={e => setVillageCity(e.target.value)}
                        className="w-full pl-9 pr-2 py-3 bg-white/5 border border-white/10 rounded-md focus:border-[#AFDDFF] focus:bg-white/10 outline-none transition-all text-sm font-tech text-white placeholder-white/20"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-tech text-white/60 uppercase tracking-widest pl-1">Classification</label>
                    <select
                      value={gender}
                      onChange={e => setGender(e.target.value as 'male' | 'female')}
                      className="w-full px-3 py-3 bg-[#0f121a] border border-white/10 rounded-md focus:border-[#AFDDFF] outline-none transition-all text-sm font-tech text-white appearance-none"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 mt-2 bg-[#AFDDFF] hover:bg-white text-black font-tech font-bold uppercase tracking-wider rounded-md transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Execute Registration'}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="login-form"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-4 w-full"
            >
              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-5 w-full">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-tech text-white/60 uppercase tracking-widest pl-1">Identifier</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="text"
                      placeholder="Username"
                      value={loginUsername}
                      onChange={e => setLoginUsername(e.target.value.toLowerCase())}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-md focus:border-[#AFDDFF] focus:bg-white/10 outline-none transition-all text-sm font-tech text-white placeholder-white/20"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-tech text-white/60 uppercase tracking-widest pl-1">Passcode</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="Password"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-md focus:border-[#AFDDFF] focus:bg-white/10 outline-none transition-all text-sm font-tech text-white placeholder-white/20"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 mt-2 bg-[#AFDDFF] hover:bg-white text-black font-tech font-bold uppercase tracking-wider rounded-md transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Initialize Session'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

