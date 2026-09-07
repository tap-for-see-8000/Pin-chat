/**
 * PIN Chat - Screen 7: Raj AI Settings Panel / Drawer
 * Package: com.aistudio.pinchat.kpmd
 * 
 * Controls:
 * - AI Auto-Reply Toggle (Enabled / Disabled)
 * - Relationship Mode Selector (Dost, GF/BF, Wife/Husband, Dost+GF)
 * - Target Gender Selector (Male, Female, Other)
 * - Language Selector (Hindi, Hinglish, Bhojpuri)
 * - "Save & Close" button
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Bot, X, Sparkles, Check, Heart, Shield, MessageSquareText } from 'lucide-react';
import { RoomAiConfig, RelationshipMode, TargetGender, RegionalLanguage } from '../types';

interface RajAiSettingsModalProps {
  config: RoomAiConfig;
  onSave: (newConfig: RoomAiConfig) => void;
  onClose: () => void;
}

export const RajAiSettingsModal: React.FC<RajAiSettingsModalProps> = ({
  config,
  onSave,
  onClose,
}) => {
  const [localConfig, setLocalConfig] = useState<RoomAiConfig>(config);

  const relationshipModes: RelationshipMode[] = ['Dost', 'GF/BF', 'Wife/Husband', 'Dost+GF'];
  const targetGenders: TargetGender[] = ['Female', 'Male', 'Other'];
  const regionalLanguages: RegionalLanguage[] = ['Hinglish', 'Hindi', 'Bhojpuri'];

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  return (
    <div
      id="raj-ai-settings-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md bg-[#0f121a] border border-white/10 rounded-2xl p-6 shadow-2xl relative text-left flex flex-col max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Raj AI (राज)
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Wingman
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Contextual AI persona &amp; auto-reply engine
              </p>
            </div>
          </div>

          <button
            id="closeRajSettingsBtn"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Setting 1: AI Auto-Reply Toggle */}
        <div className="py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-white block">
              Enable Auto-Reply
            </span>
            <span className="text-xs text-slate-400 block mt-0.5">
              Raj responds automatically with smart 2-8s delay
            </span>
          </div>

          <button
            id="toggleAutoReplyBtn"
            type="button"
            onClick={() =>
              setLocalConfig((prev) => ({
                ...prev,
                enabled: !prev.enabled,
                autoReply: !prev.enabled,
              }))
            }
            className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
              localConfig.enabled ? 'bg-amber-500' : 'bg-[#1c2230]'
            }`}
          >
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`w-4.5 h-4.5 rounded-full bg-slate-950 shadow-md transform ${
                localConfig.enabled ? 'translate-x-5.5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Setting 2: Relationship Mode Selector */}
        <div className="py-4 border-b border-white/10">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
            <Heart className="w-3.5 h-3.5 text-amber-400" />
            Relationship Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            {relationshipModes.map((mode) => {
              const isSelected = localConfig.relationshipMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    setLocalConfig((prev) => ({ ...prev, relationshipMode: mode }))
                  }
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                      : 'bg-[#161b26] border-white/10 text-slate-300 hover:border-white/20'
                  }`}
                >
                  <span>{mode}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Setting 3: Target Gender Selector */}
        <div className="py-4 border-b border-white/10">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            Target Gender
          </label>
          <div className="grid grid-cols-3 gap-2">
            {targetGenders.map((gender) => {
              const isSelected = localConfig.targetGender === gender;
              return (
                <button
                  key={gender}
                  type="button"
                  onClick={() =>
                    setLocalConfig((prev) => ({ ...prev, targetGender: gender }))
                  }
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                      : 'bg-[#161b26] border-white/10 text-slate-300 hover:border-white/20'
                  }`}
                >
                  <span>{gender}</span>
                  {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Setting 4: Regional Language Selector */}
        <div className="py-4 border-b border-white/10">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
            <MessageSquareText className="w-3.5 h-3.5 text-amber-400" />
            Language / Dialect
          </label>
          <div className="grid grid-cols-3 gap-2">
            {regionalLanguages.map((lang) => {
              const isSelected = localConfig.language === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() =>
                    setLocalConfig((prev) => ({ ...prev, language: lang }))
                  }
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                      : 'bg-[#161b26] border-white/10 text-slate-300 hover:border-white/20'
                  }`}
                >
                  <span>{lang}</span>
                  {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Persona Description Hint */}
        <div className="my-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Configured Persona:</span>
            <span>
              Raj will converse in{' '}
              <strong className="text-white">{localConfig.language}</strong> as a{' '}
              <strong className="text-white">{localConfig.relationshipMode}</strong> persona
              for a <strong className="text-white">{localConfig.targetGender}</strong> partner.
            </span>
          </div>
        </div>

        {/* Action Button: Save & Close */}
        <button
          id="saveRajSettingsBtn"
          type="button"
          onClick={handleSave}
          className="w-full py-3.5 px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer active:scale-[0.98]"
        >
          <span>Save &amp; Close</span>
        </button>
      </motion.div>
    </div>
  );
};
