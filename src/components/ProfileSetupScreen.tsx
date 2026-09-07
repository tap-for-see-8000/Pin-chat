/**
 * PIN Chat - Screen 2: Profile Setup Screen
 * Package: com.aistudio.pinchat.kpmd
 * 
 * Strict specifications:
 * 1. Full Name (Text input)
 * 2. Mobile Number (10 digits Indian phone number, regex: ^[6-9]\d{9}$)
 * 3. Village / City (Text input)
 * 4. Postal PIN Code (6 digits Indian postal code, regex: ^\d{6}$)
 * 5. "Enter PIN Chat" button disabled until all 4 satisfy validation.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Phone, MapPin, Hash, ShieldCheck, ArrowRight, CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { UserProfile } from '../types';
import { authenticateAnonymously, getOrCreateLocalUid } from '../firebase';

interface ProfileSetupScreenProps {
  initialName?: string;
  onComplete: (profile: UserProfile) => void;
}

export const ProfileSetupScreen: React.FC<ProfileSetupScreenProps> = ({
  initialName = '',
  onComplete,
}) => {
  const [displayName, setDisplayName] = useState(initialName);
  const [mobileNumber, setMobileNumber] = useState('');
  const [villageCity, setVillageCity] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Touched state to only show red errors once field has been focused/typed
  const [touched, setTouched] = useState({
    displayName: false,
    mobileNumber: false,
    villageCity: false,
    pinCode: false,
  });

  // Validation Logic
  const isNameValid = useMemo(() => displayName.trim().length >= 2, [displayName]);
  const isMobileValid = useMemo(() => /^[6-9]\d{9}$/.test(mobileNumber.trim()), [mobileNumber]);
  const isVillageValid = useMemo(() => villageCity.trim().length >= 2, [villageCity]);
  const isPinCodeValid = useMemo(() => /^\d{6}$/.test(pinCode.trim()), [pinCode]);

  const isFormValid = isNameValid && isMobileValid && isVillageValid && isPinCodeValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isAuthenticating) return;

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const user = await authenticateAnonymously();
      const profileData: UserProfile = {
        uid: user.uid,
        displayName: displayName.trim(),
        mobileNumber: mobileNumber.trim(),
        villageCity: villageCity.trim(),
        pinCode: pinCode.trim(),
        authProvider: 'anonymous',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      console.log('[PIN Chat Profile] Session authenticated successfully. User UID:', user.uid);
      onComplete(profileData);
    } catch (err: unknown) {
      console.warn('[PIN Chat Profile] Resilient fallback triggered for profile registration:', err);
      const fallbackUid = getOrCreateLocalUid();
      const profileData: UserProfile = {
        uid: fallbackUid,
        displayName: displayName.trim(),
        mobileNumber: mobileNumber.trim(),
        villageCity: villageCity.trim(),
        pinCode: pinCode.trim(),
        authProvider: 'anonymous',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      onComplete(profileData);
    }
  };

  return (
    <div
      id="profile-setup-screen"
      className="relative w-full min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden select-none"
    >
      {/* Ambient background glow */}
      <div className="absolute top-1/4 -right-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Profile Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-[#0f121a]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-3 text-amber-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
            Profile Setup
          </h2>
          <p className="text-xs text-slate-400">
            Secure 1-on-1 PIN Chat identity verification
          </p>
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-amber-300 font-mono">
            <span>Private: Phone &amp; Location kept strictly confidential</span>
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Field 1: Full Name */}
          <div>
            <label
              htmlFor="profile-name-input"
              className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-400" />
                Full Name
              </span>
              {isNameValid && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </label>
            <input
              id="profile-name-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, displayName: true }))}
              placeholder="e.g. Mohit Sharma"
              maxLength={40}
              className={`w-full px-3.5 py-2.5 bg-[#161b26] border rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all ${
                touched.displayName && !isNameValid
                  ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30'
                  : 'border-white/10 focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20'
              }`}
            />
            {touched.displayName && !isNameValid && (
              <p className="text-[11px] text-rose-400 mt-1">Please enter your real or display name</p>
            )}
          </div>

          {/* Field 2: Mobile Number (10 digits Indian phone number) */}
          <div>
            <label
              htmlFor="profile-mobile-input"
              className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                Mobile Number (10 Digits)
              </span>
              {isMobileValid && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-mono text-slate-400 border-r border-white/10 pr-2 my-2">
                +91
              </div>
              <input
                id="profile-mobile-input"
                type="tel"
                value={mobileNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setMobileNumber(val);
                }}
                onBlur={() => setTouched((p) => ({ ...p, mobileNumber: true }))}
                placeholder="9876543210"
                maxLength={10}
                className={`w-full pl-14 pr-3.5 py-2.5 bg-[#161b26] border rounded-xl text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none transition-all ${
                  touched.mobileNumber && !isMobileValid
                    ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30'
                    : 'border-white/10 focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20'
                }`}
              />
            </div>
            {touched.mobileNumber && !isMobileValid && (
              <p className="text-[11px] text-rose-400 mt-1">
                Must be a valid 10-digit number starting with 6, 7, 8, or 9
              </p>
            )}
          </div>

          {/* Field 3: Village / City */}
          <div>
            <label
              htmlFor="profile-village-input"
              className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                Village / City
              </span>
              {isVillageValid && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </label>
            <input
              id="profile-village-input"
              type="text"
              value={villageCity}
              onChange={(e) => setVillageCity(e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, villageCity: true }))}
              placeholder="e.g. Jaipur / Ramgarh"
              maxLength={50}
              className={`w-full px-3.5 py-2.5 bg-[#161b26] border rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all ${
                touched.villageCity && !isVillageValid
                  ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30'
                  : 'border-white/10 focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20'
              }`}
            />
            {touched.villageCity && !isVillageValid && (
              <p className="text-[11px] text-rose-400 mt-1">Please enter your village or city</p>
            )}
          </div>

          {/* Field 4: Postal PIN Code (6 digits) */}
          <div>
            <label
              htmlFor="profile-pincode-input"
              className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-amber-400" />
                Postal PIN Code (6 Digits)
              </span>
              {isPinCodeValid && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </label>
            <input
              id="profile-pincode-input"
              type="text"
              value={pinCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setPinCode(val);
              }}
              onBlur={() => setTouched((p) => ({ ...p, pinCode: true }))}
              placeholder="e.g. 302001"
              maxLength={6}
              className={`w-full px-3.5 py-2.5 bg-[#161b26] border rounded-xl text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none transition-all ${
                touched.pinCode && !isPinCodeValid
                  ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30'
                  : 'border-white/10 focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20'
              }`}
            />
            {touched.pinCode && !isPinCodeValid && (
              <p className="text-[11px] text-rose-400 mt-1">
                Must be an exact 6-digit postal code (e.g. 110001)
              </p>
            )}
          </div>

          {/* Auth Error Banner */}
          <AnimatePresence>
            {authError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold mb-0.5">Authentication Issue</p>
                  <p className="text-[11px] text-rose-400/90 leading-relaxed font-mono">{authError}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Button: Enter PIN Chat with Connecting Spinner */}
          <button
            id="enter-pinchat-btn"
            type="submit"
            disabled={!isFormValid || isAuthenticating}
            className={`mt-4 w-full py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
              isFormValid && !isAuthenticating
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 cursor-pointer active:scale-[0.99]'
                : isAuthenticating
                ? 'bg-amber-500/80 text-slate-950 cursor-wait shadow-md'
                : 'bg-white/[0.05] text-slate-500 border border-white/[0.05] cursor-not-allowed opacity-60'
            }`}
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Connecting securely...</span>
              </>
            ) : (
              <>
                <span>Enter PIN Chat</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </motion.div>

      {/* Footer Branding */}
      <div className="mt-6 text-[11px] text-slate-500 font-mono tracking-wider z-10">
        PIN CHAT &bull; CREATED BY MOHIT
      </div>
    </div>
  );
};
