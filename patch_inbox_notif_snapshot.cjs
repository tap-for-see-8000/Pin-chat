const fs = require('fs');
let code = fs.readFileSync('src/components/InboxScreen.tsx', 'utf8');

const oldEffect = `  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setIsLoadingNotifs(true);
        const notifs = await getNotifications(currentUser.username);
        // Fetch sender profiles for notifications
        const withProfiles = await Promise.all(notifs.map(async (n) => {
          const senderRes = await searchUserByUsername(n.senderUsername, currentUser.username);
          return { ...n, senderProfile: senderRes.user || undefined };
        }));
        setNotifications(withProfiles);
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        setIsLoadingNotifs(false);
      }
    };
    fetchNotifications();
  }, [currentUser.username]);`;

const newEffect = `  useEffect(() => {
    if (!db) return;
    try {
      setIsLoadingNotifs(true);
      const q = query(
        collection(db, 'notifications'), 
        where('receiverUsername', '==', currentUser.username), 
        where('handled', '==', false)
      );
      const unsub = onSnapshot(q, async (snap) => {
        const notifs = snap.docs.map(d => d.data() as AppNotification).sort((a, b) => b.timestamp - a.timestamp);
        
        const withProfiles = await Promise.all(notifs.map(async (n) => {
          const senderRes = await searchUserByUsername(n.senderUsername, currentUser.username);
          return { ...n, senderProfile: senderRes.user || undefined };
        }));
        setNotifications(withProfiles);
        setIsLoadingNotifs(false);
      });
      return () => unsub();
    } catch (err) {
      console.warn("Notifications sync error:", err);
      setIsLoadingNotifs(false);
    }
  }, [currentUser.username]);`;

code = code.replace(oldEffect, newEffect);
fs.writeFileSync('src/components/InboxScreen.tsx', code);
