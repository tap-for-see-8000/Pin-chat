const fs = require('fs');
let code = fs.readFileSync('src/components/ChatProfilePanel.tsx', 'utf8');

// Ensure the back button is on the left
code = code.replace(
  `      <div className="sticky top-0 z-20 glass-panel border-b-0 px-4 py-4 flex items-center justify-between">
        <h2 className="text-sm font-tech text-[#AFDDFF] uppercase tracking-widest">// USER_NODE</h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>`,
  `      <div className="sticky top-0 z-20 glass-panel border-b-0 px-4 py-4 flex items-center gap-3">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-[11px] font-tech text-[#AFDDFF]/70 uppercase tracking-widest flex-1">// USER_PROFILE</h2>
      </div>`
);

if (!code.includes('ArrowLeft')) {
  code = code.replace("import { Lock, Unlock, Clock, Users, Flame, BookOpen, Target, Activity, X } from 'lucide-react';", "import { Lock, Unlock, Clock, Users, Flame, BookOpen, Target, Activity, X, ArrowLeft } from 'lucide-react';");
}

fs.writeFileSync('src/components/ChatProfilePanel.tsx', code);
