/**
 * PIN Chat - Decoy Business Notifications Chat Screen
 * Package: com.aistudio.pinchat.kpmd
 * 
 * Opened silently when a user enters the wrong pass-emoji.
 * Outsiders will believe it is an automated business notification thread (Amazon, Zomato, BlueDart, Delhivery).
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Package,
  CheckCheck,
  Send,
  ShieldCheck,
  Building2,
  Truck,
  ExternalLink,
  Info,
} from 'lucide-react';
import { PublicUserProfile, DecoyMessage } from '../types';

interface DecoyChatScreenProps {
  targetUser: PublicUserProfile;
  onBack: () => void;
  onUnlockRealChat?: () => void;
}

const INITIAL_DECOY_MESSAGES: DecoyMessage[] = [
  {
    id: 'decoy-1',
    sender: 'Amazon Logistics',
    service: 'Amazon',
    text: 'Package #AZ-99201 has been dispatched from Fulfillment Center (Hub Gurugram). Expected arrival by 6:00 PM.',
    time: '10:14 AM',
    badge: 'Dispatched',
  },
  {
    id: 'decoy-2',
    sender: 'Zomato Food',
    service: 'Zomato',
    text: 'Order #ZM-84920 from Royal Kitchen confirmed. Delivery partner is on the way with your meal.',
    time: '12:35 PM',
    badge: 'On The Way',
  },
  {
    id: 'decoy-3',
    sender: 'BlueDart Express',
    service: 'BlueDart',
    text: 'Shipment AWB #84920194 out for delivery to recipient. Please keep your valid government ID ready.',
    time: '02:18 PM',
    badge: 'Out for Delivery',
  },
  {
    id: 'decoy-4',
    sender: 'Delhivery',
    service: 'Delhivery',
    text: 'Your courier OTP is 4819. Share this OTP strictly with your delivery executive upon receiving parcel.',
    time: '03:45 PM',
    badge: 'Security OTP',
  },
  {
    id: 'decoy-5',
    sender: 'Amazon Logistics',
    service: 'Amazon',
    text: 'Shipment #AZ-99201 successfully delivered to front desk / recipient. Thank you for shopping with Amazon.',
    time: '04:12 PM',
    badge: 'Delivered',
  },
];

export const DecoyChatScreen: React.FC<DecoyChatScreenProps> = ({
  targetUser,
  onBack,
  onUnlockRealChat,
}) => {
  const [messages, setMessages] = useState<DecoyMessage[]>(INITIAL_DECOY_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg: DecoyMessage = {
      id: `decoy-user-${Date.now()}`,
      sender: 'You',
      service: 'You',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isUser: true,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsReplying(true);

    // Simulate automated service reply
    setTimeout(() => {
      const autoResponses = [
        'Automated Support Notification: This is an unmonitored notification channel. For parcel inquiries, please refer to your carrier tracking portal.',
        'System Notice: Delivery status confirmed. Replies to this automated SMS thread are unmonitored.',
        'Order Assistance: Your inquiry has been routed to centralized logistics. Please visit the app for live agent chat.',
      ];
      const randomResponse = autoResponses[Math.floor(Math.random() * autoResponses.length)];

      const botReply: DecoyMessage = {
        id: `decoy-bot-${Date.now()}`,
        sender: 'Central Logistics Bot',
        service: 'Support',
        text: randomResponse,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botReply]);
      setIsReplying(false);
    }, 900);
  };

  return (
    <div
      id="decoy-chat-screen"
      className="w-full min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center select-none"
    >
      {/* 1. Header with official delivery branding */}
      <header
        id="decoyHeader"
        className="w-full px-4 py-3 bg-[#0f121a]/95 backdrop-blur-xl border-b border-white/10 flex items-center justify-between z-20 shrink-0 sticky top-0 shadow-lg"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer active:scale-95"
            title="Back to Inbox"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold shrink-0">
              <Package className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white tracking-tight">
                  Express Courier & Delivery Alerts
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/15 px-1.5 py-0.2 rounded border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Verified
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                Official Business Notifications • No-Reply
              </div>
            </div>
          </div>
        </div>

        {/* Subtle unlock icon for owner */}
        {onUnlockRealChat && (
          <button
            type="button"
            onClick={onUnlockRealChat}
            className="p-2 text-slate-600 hover:text-slate-400 rounded-lg transition-colors cursor-pointer"
            title="Re-enter security verification"
          >
            <Info className="w-4 h-4" />
          </button>
        )}
      </header>

      {/* 2. Decoy Messages Feed */}
      <main
        id="decoyMessagesFeed"
        className="flex-1 w-full max-w-2xl mx-auto overflow-y-auto px-4 py-5 flex flex-col gap-3.5"
      >
        {/* Security / Notice banner */}
        <div className="w-full py-2 px-3 rounded-xl bg-[#0f121a]/80 border border-white/[0.06] text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>Automated carrier shipping notifications for account alerts</span>
        </div>

        {messages.map((msg) => {
          const isUser = Boolean(msg.isUser);

          return (
            <div
              key={msg.id}
              className={`w-full flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              {!isUser && (
                <div className="flex items-center gap-1.5 mb-1 ml-1 text-[11px] font-mono">
                  <span className="font-bold text-blue-400">{msg.sender}</span>
                  {msg.badge && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/25 text-[10px] text-blue-300">
                      {msg.badge}
                    </span>
                  )}
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-md px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                  isUser
                    ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none'
                    : 'bg-[#161b26] border border-white/10 text-slate-200 rounded-tl-none'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                <div
                  className={`text-[10px] font-mono mt-1 flex items-center justify-end gap-1 ${
                    isUser ? 'text-slate-900/70 font-semibold' : 'text-slate-500'
                  }`}
                >
                  <span>{msg.time}</span>
                  {isUser && <CheckCheck className="w-3 h-3 text-slate-900/70" />}
                </div>
              </div>
            </div>
          );
        })}

        {isReplying && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono italic ml-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span>Automated notification server processing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* 3. Input Footer */}
      <footer className="w-full max-w-2xl px-4 py-3 bg-[#0f121a]/95 backdrop-blur-xl border-t border-white/10 shrink-0 sticky bottom-0">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            id="decoyChatInput"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Inquire tracking # or shipment update..."
            className="flex-1 px-4 py-3 bg-[#161b26] border border-white/10 focus:border-blue-500/60 rounded-xl text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none transition-all"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
};
