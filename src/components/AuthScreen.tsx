/**
 * PIN Chat - Authentication & Registration Screen
 * Package: com.aistudio.pinchat.kpmd
 * 
 * Features:
 * 1. New User Registration:
 *    - Full Name (e.g. "Mohit Yadav")
 *    - 10-digit Mobile Number
 *    - Village / City (गांव / शहर)
 *    - Pincode (पिन कोड)
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

import React, { useState } from 'react';
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
  Hash,
  Copy,
  Check,
  ArrowRight,
  AlertCircle,
  Loader2,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { UserRecord } from '../types';
import {
  registerNewUser,
  loginWithCredentials,
  generateCredentials,
  saveCurrentSession,
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
  const [pinCode, setPinCode] = useState('');

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

  // Handle Registration Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanMobile = mobileNumber.replace(/\D/g, '');
    const cleanPin = pinCode.replace(/\D/g, '');

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
    if (cleanPin.length !== 6) {
      setErrorMessage('Please enter a valid 6-digit Pincode (पिन कोड).');
      return;
    }

    setIsLoading(true);

    try {
      const res = await registerNewUser({
        fullName,
        mobileNumber: cleanMobile,
        villageCity,
        pinCode: cleanPin,
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
      className="relative w-full min-h-screen flex flex-col items-center justify-center p-4 select-none bg-[#07090e] overflow-y-auto"
    >
      {/* Background Ambience */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Authentication Container */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-[#0f121a]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 my-8"
      >
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-3 text-amber-400 shadow-inner">
            <MessageSquare className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            PIN Chat
          </h1>
          <p className="text-xs font-mono uppercase tracking-widest text-amber-400 mt-1">
            Private 1-on-1 Messaging
          </p>
        </div>

        {/* Tab Switcher: Register / Login */}
        <div className="w-full grid grid-cols-2 p-1 bg-[#161b26] border border-white/10 rounded-xl mb-6">
          <button
            id="tabRegisterBtn"
            type="button"
            onClick={() => {
              setAuthMode('register');
              setErrorMessage(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              authMode === 'register'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>New User</span>
          </button>
          <button
            id="tabLoginBtn"
            type="button"
            onClick={() => {
              setAuthMode('login');
              setErrorMessage(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              authMode === 'login'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Existing Login</span>
          </button>
        </div>

        {/* Error Notification Container */}
        {errorMessage && (
          <div
            id="authErrorMessage"
            className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-fade-in"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* MODE 1: REGISTRATION FORM */}
        {authMode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3.5 text-left">
            {/* Full Name Input */}
            <div>
              <label
                htmlFor="regFullNameInput"
                className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5"
              >
                <UserIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Full Name (पूरा नाम)</span>
              </label>
              <input
                id="regFullNameInput"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Mohit Yadav"
                required
                className="w-full px-3.5 py-2.5 bg-[#161b26] border border-white/10 focus:border-amber-500/80 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none transition-all"
              />
            </div>

            {/* 10-Digit Mobile Number Input */}
            <div>
              <label
                htmlFor="regMobileInput"
                className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>10-Digit Mobile Number (मोबाइल नंबर)</span>
              </label>
              <input
                id="regMobileInput"
                type="tel"
                value={mobileNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setMobileNumber(val);
                }}
                maxLength={10}
                placeholder="e.g. 9876548976"
                required
                className="w-full px-3.5 py-2.5 bg-[#161b26] border border-white/10 focus:border-amber-500/80 rounded-xl text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none transition-all"
              />
            </div>

            {/* Village / City Input */}
            <div>
              <label
                htmlFor="regVillageCityInput"
                className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>Village / City (गांव या शहर)</span>
              </label>
              <input
                id="regVillageCityInput"
                type="text"
                value={villageCity}
                onChange={(e) => setVillageCity(e.target.value)}
                placeholder="e.g. Rampur, Varanasi"
                required
                className="w-full px-3.5 py-2.5 bg-[#161b26] border border-white/10 focus:border-amber-500/80 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none transition-all"
              />
            </div>

            {/* Pincode Input */}
            <div>
              <label
                htmlFor="regPinCodeInput"
                className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5"
              >
                <Hash className="w-3.5 h-3.5 text-amber-400" />
                <span>6-Digit Pincode (पिन कोड)</span>
              </label>
              <input
                id="regPinCodeInput"
                type="text"
                value={pinCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setPinCode(val);
                }}
                maxLength={6}
                placeholder="e.g. 221001"
                required
                className="w-full px-3.5 py-2.5 bg-[#161b26] border border-white/10 focus:border-amber-500/80 rounded-xl text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none transition-all"
              />
            </div>

            {/* Live Auto-Generated Credentials Preview */}
            {previewCreds && (
              <div className="mt-1 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col gap-1.5 text-xs text-amber-200">
                <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Generated Credentials Preview:</span>
                </div>
                <div className="flex items-center justify-between font-mono text-[11px] pt-1">
                  <span>Username:</span>
                  <span className="font-bold text-white bg-black/40 px-2 py-0.5 rounded border border-white/10">
                    {previewCreds.username}
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span>Password:</span>
                  <span className="font-bold text-white bg-black/40 px-2 py-0.5 rounded border border-white/10">
                    {previewCreds.password}
                  </span>
                </div>
              </div>
            )}

            {/* Submit Registration Button */}
            <button
              id="submitRegisterBtn"
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account & Get Credentials</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* MODE 2: LOGIN FORM */}
        {authMode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4 text-left">
            {/* Username Input */}
            <div>
              <label
                htmlFor="loginUsernameInput"
                className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5"
              >
                <UserIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Username (e.g. mohit8976)</span>
              </label>
              <input
                id="loginUsernameInput"
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value.toLowerCase().trim())}
                placeholder="Enter your registered username"
                required
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full px-3.5 py-2.5 bg-[#161b26] border border-white/10 focus:border-amber-500/80 rounded-xl text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none transition-all"
              />
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="loginPasswordInput"
                className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Password (e.g. mohit9876)</span>
              </label>
              <div className="relative">
                <input
                  id="loginPasswordInput"
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value.trim())}
                  placeholder="Enter your password"
                  required
                  className="w-full px-3.5 py-2.5 pr-10 bg-[#161b26] border border-white/10 focus:border-amber-500/80 rounded-xl text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                >
                  {showLoginPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Login Button */}
            <button
              id="submitLoginBtn"
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <span>Login to Chat Inbox</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Security & Persistent Session Footer */}
        <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-center gap-2 text-[11px] text-slate-400 text-center">
          <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Persistent session &bull; Refreshing will never log you out</span>
        </div>
      </motion.div>

      {/* POPUP MODAL: CREATED CREDENTIALS DISPLAY */}
      <AnimatePresence>
        {createdUser && (
          <div
            id="createdCredentialsModalBackdrop"
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-[#0f121a] border border-amber-500/40 rounded-2xl p-6 sm:p-7 shadow-2xl text-center relative"
            >
              {/* Success Badge */}
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto mb-3 shadow-inner">
                <Check className="w-7 h-7" />
              </div>

              <h2 className="text-xl font-bold text-white mb-1">
                Registration Successful!
              </h2>
              <p className="text-xs text-slate-300 max-w-xs mx-auto mb-5 leading-relaxed">
                Your account is saved in Firestore. Please copy and save your login credentials below:
              </p>

              {/* Credentials Box */}
              <div className="w-full bg-[#161b26] border border-white/10 rounded-xl p-4 flex flex-col gap-3 text-left mb-5">
                {/* Username */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
                      Generated Username
                    </span>
                    <span className="text-base font-bold font-mono text-amber-300">
                      {createdUser.username}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdUser.username, 'username')}
                    className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                    title="Copy Username"
                  >
                    {copiedField === 'username' ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-amber-400" />
                    )}
                  </button>
                </div>

                <div className="h-[1px] bg-white/[0.08]" />

                {/* Password */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
                      Generated Password
                    </span>
                    <span className="text-base font-bold font-mono text-amber-300">
                      {createdUser.password}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdUser.password, 'password')}
                    className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                    title="Copy Password"
                  >
                    {copiedField === 'password' ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-amber-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Copy All Button */}
              <button
                type="button"
                onClick={() => {
                  const text = `PIN Chat Credentials:\nUsername: ${createdUser.username}\nPassword: ${createdUser.password}`;
                  copyToClipboard(text, 'all');
                }}
                className="w-full py-2.5 px-4 mb-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-mono text-amber-300 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {copiedField === 'all' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Credentials Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy All Credentials</span>
                  </>
                )}
              </button>

              {/* Proceed to Chat Button */}
              <button
                id="continueToChatBtn"
                type="button"
                onClick={() => onAuthSuccess(createdUser)}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer active:scale-[0.98] transition-all"
              >
                <span>Continue to Chat Inbox</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
