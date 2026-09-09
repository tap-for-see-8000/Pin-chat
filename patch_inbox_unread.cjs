const fs = require('fs');
let code = fs.readFileSync('src/components/InboxScreen.tsx', 'utf8');

// The conversation list renders ChatConversation items.
// User wants to see green dot for unread, and timestamp.
const convoBlockRegex = /<div className="min-w-0 flex-1">[\s\S]*?<\/div>\s*<\/button>/g;

// Instead of regex on HTML, let's inject it properly.
// Find the conversation item rendering
// They are mapping over `conversations`
code = code.replace(
  '<div className="min-w-0 flex-1">\n                      <div className="flex justify-between items-baseline mb-0.5">\n                        <span className="font-display font-bold text-white uppercase tracking-wider truncate text-sm">',
  `<div className="min-w-0 flex-1">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="font-display font-bold text-white uppercase tracking-wider truncate text-sm flex items-center gap-2">`
);

// We need to find where the name is rendered to put the green dot.
// It looks like: `{conv.otherUser.fullName}`
// I'll replace `{conv.otherUser.fullName}` with `{conv.otherUser.fullName} {conv.unread && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}`
code = code.replace(
  "{conv.otherUser.fullName}\n                        </span>",
  "{conv.otherUser.fullName} {conv.unread && <div className=\"w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]\" />}\n                        </span>"
);

// Timestamp:
// The timestamp is probably not rendered, or rendered with `new Date`. Let's add it next to the name.
// Replace `<span className="text-[10px] text-slate-500 font-mono shrink-0">` if it exists.
if (code.includes('formatTime(conv.lastMessageTime)')) {
  // Already has it
} else if (code.includes('text-slate-500 font-mono shrink-0')) {
  code = code.replace(
    /<span className="text-\[10px\] text-slate-500 font-mono shrink-0">.*?<\/span>/,
    `<span className="text-[10px] text-[#AFDDFF]/70 font-mono shrink-0">
                          {new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>`
  );
} else {
  code = code.replace(
    "{conv.otherUser.fullName} {conv.unread && <div className=\"w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]\" />}\n                        </span>",
    `{conv.otherUser.fullName} {conv.unread && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
                        </span>
                        <span className="text-[10px] text-[#AFDDFF]/70 font-mono shrink-0">
                          {new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>`
  );
}

fs.writeFileSync('src/components/InboxScreen.tsx', code);
