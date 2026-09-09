const fs = require('fs');
let code = fs.readFileSync('src/components/ChatProfilePanel.tsx', 'utf8');
code = code.replace(
  "import { X, Lock, Unlock, Clock, Activity, Target, Flame, Users, BookOpen } from 'lucide-react';",
  "import { X, Lock, Unlock, Clock, Activity, Target, Flame, Users, BookOpen, ArrowLeft } from 'lucide-react';"
);
fs.writeFileSync('src/components/ChatProfilePanel.tsx', code);
