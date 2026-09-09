const fs = require('fs');
let code = fs.readFileSync('src/components/WeeklyReportScreen.tsx', 'utf8');

// I need to add BarChart2 to imports
code = code.replace(
  "import React, { useEffect, useState } from 'react';",
  "import React, { useEffect, useState } from 'react';\nimport { BarChart2 } from 'lucide-react';"
);

// I need to define stats and dominantMood
const definedStats = `
  const counts = {
    happy: moods.filter(m => m.mood === 'happy').length,
    sad: moods.filter(m => m.mood === 'sad').length,
    low: moods.filter(m => m.mood === 'low').length,
    angry: moods.filter(m => m.mood === 'angry').length,
    'missing anyone': moods.filter(m => m.mood === 'missing anyone').length,
  };

  const stats = [
    { id: 'happy', emoji: '🟢', label: 'Optimal', count: counts.happy, color: 'bg-emerald-500' },
    { id: 'sad', emoji: '🔵', label: 'Degraded', count: counts.sad, color: 'bg-blue-500' },
    { id: 'low', emoji: '🟡', label: 'Low Power', count: counts.low, color: 'bg-amber-500' },
    { id: 'angry', emoji: '🔴', label: 'Critical', count: counts.angry, color: 'bg-rose-500' },
    { id: 'missing anyone', emoji: '🟣', label: 'Searching', count: counts['missing anyone'], color: 'bg-purple-500' }
  ];

  const dominantStat = [...stats].sort((a, b) => b.count - a.count)[0];
  const dominantMood = {
    emoji: dominantStat.count > 0 ? dominantStat.emoji : '⚪',
    title: dominantStat.count > 0 ? dominantStat.label : 'Inactive',
    desc: dominantStat.count > 0 ? \`System most frequently reported \${dominantStat.label}\` : 'No data logged for current cycle'
  };
`;

code = code.replace(/const counts = \{[\s\S]*?\};\n/, definedStats);

// Remove the second return block that got duplicated
// Actually, earlier the script might have failed to replace or there were two returns.
// Let's use regex to remove anything after the FIRST "  );\n}"
const firstReturnMatch = code.match(/return \([\s\S]*?\);\n\}/);
if (firstReturnMatch) {
  const correctCode = code.slice(0, firstReturnMatch.index + firstReturnMatch[0].length);
  fs.writeFileSync('src/components/WeeklyReportScreen.tsx', correctCode);
} else {
  fs.writeFileSync('src/components/WeeklyReportScreen.tsx', code);
}
