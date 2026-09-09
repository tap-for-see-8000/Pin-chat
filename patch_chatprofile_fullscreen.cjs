const fs = require('fs');

let code = fs.readFileSync('src/components/ChatProfilePanel.tsx', 'utf8');

// Replace bottom sheet animation and styling with full screen
code = code.replace(
  `initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute bottom-0 left-0 w-full max-h-[85vh] bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-[#AFDDFF]/20 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-50 overflow-y-auto"`,
  `initial={{ x: '100%', opacity: 0.5 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0.5 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-0 bg-[#050505] z-50 overflow-y-auto flex flex-col"`
);

code = code.replace(
  `className="sticky top-0 z-20 flex justify-between items-center p-4 bg-black/60 backdrop-blur-md border-b border-[#AFDDFF]/10"`,
  `className="sticky top-0 z-20 flex items-center p-4 bg-[#050505]/80 backdrop-blur-md border-b border-[#AFDDFF]/10"`
);

// In the header, instead of X button on right, let's put an ArrowLeft on the left, or just keep X but adjust layout.
code = code.replace(
  `        <div className="w-10" /> {/* Spacer for centering */}
        <h2 className="text-[10px] font-tech text-white/50 uppercase tracking-widest">// USER_NODE</h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>`,
  `        <button onClick={onClose} className="p-2 -ml-2 mr-3 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors active:scale-95">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-[11px] font-tech text-white/50 uppercase tracking-widest flex-1">// USER_PROFILE</h2>`
);

// We need to import ArrowLeft if it's not imported
if (!code.includes('ArrowLeft')) {
  code = code.replace("import { Lock, Unlock, Clock, Users, Flame, BookOpen, Target, Activity, X } from 'lucide-react';", "import { Lock, Unlock, Clock, Users, Flame, BookOpen, Target, Activity, X, ArrowLeft } from 'lucide-react';");
}

fs.writeFileSync('src/components/ChatProfilePanel.tsx', code);
