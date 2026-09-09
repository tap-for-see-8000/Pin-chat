const fs = require('fs');

let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

if (!code.includes("const [liveTargetUser, setLiveTargetUser]")) {
  code = code.replace(
    "const [targetUserGoal, setTargetUserGoal] = useState<any>(null);",
    "const [targetUserGoal, setTargetUserGoal] = useState<any>(null);\n  const [liveTargetUser, setLiveTargetUser] = useState<PublicUserProfile>(targetUser);"
  );
  
  // Add effect to listen to targetUser document
  const effectCode = `
  useEffect(() => {
    if (!db) return;
    const userRef = doc(db, 'users', targetUser.username.toLowerCase());
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setLiveTargetUser(prev => ({ ...prev, ...(snap.data() as any) }));
      }
    });
    return () => unsub();
  }, [targetUser.username]);
  `;
  
  code = code.replace(
    "useEffect(() => {\n    // Fake Chat Logic Initialization",
    effectCode + "\n  useEffect(() => {\n    // Fake Chat Logic Initialization"
  );
  
  // Replace targetUser with liveTargetUser in the Header UI
  code = code.replace(
    `            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full border border-white/20 bg-black flex items-center justify-center overflow-hidden">
                {targetUser.avatarUrl ? (
                  <img src={targetUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover filter grayscale" />
                ) : (
                  <span className="text-white/60 font-tech text-lg">{targetUser.fullName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className={\`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0A0A0A] \${partnerPresence.isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-500'}\`} />
            </div>
            
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-display font-bold text-white uppercase tracking-wider truncate">
                {targetUser.fullName}
              </h2>`,
    `            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full border border-white/20 bg-black flex items-center justify-center overflow-hidden">
                {liveTargetUser.avatarUrl ? (
                  <img src={liveTargetUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover filter grayscale" />
                ) : (
                  <span className="text-white/60 font-tech text-lg">{liveTargetUser.fullName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className={\`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0A0A0A] \${partnerPresence.isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-500'}\`} />
            </div>
            
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-display font-bold text-white uppercase tracking-wider truncate">
                {liveTargetUser.fullName}
              </h2>`
  );

  // We should also pass liveTargetUser down to ChatProfilePanel
  code = code.replace(
    `<ChatProfilePanel 
            targetUser={targetUser}`,
    `<ChatProfilePanel 
            targetUser={liveTargetUser}`
  );
  
  // And to EmojiGatewayModal if used, though it doesn't really matter there.

  fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);
}
