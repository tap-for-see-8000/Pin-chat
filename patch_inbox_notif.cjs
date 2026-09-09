const fs = require('fs');
let code = fs.readFileSync('src/components/InboxScreen.tsx', 'utf8');

const importReplacement = `import { AppNotification } from '../types';
import { getNotifications, acceptFriendRequest, rejectFriendRequest, getPendingFriendRequestById } from '../services/appService';`;

code = code.replace(
  `import { UserRecord, PublicUserProfile, ChatConversation } from '../types';`,
  `import { UserRecord, PublicUserProfile, ChatConversation, AppNotification } from '../types';
import { getNotifications, acceptFriendRequest, rejectFriendRequest } from '../services/appService';`
);

const stateReplacement = `  // Notifications
  const [notifications, setNotifications] = useState<(AppNotification & { senderProfile?: PublicUserProfile })[]>([]);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);
  
  useEffect(() => {
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
  }, [currentUser.username]);

  const handleAcceptRequest = async (notif: AppNotification & { senderProfile?: PublicUserProfile }) => {
    try {
      await acceptFriendRequest(notif.relatedRequestId, notif.senderUsername, notif.receiverUsername);
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectRequest = async (notif: AppNotification & { senderProfile?: PublicUserProfile }) => {
    try {
      await rejectFriendRequest(notif.relatedRequestId);
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
    } catch (err) {
      console.error(err);
    }
  };

  // Sync conversations`;

code = code.replace(`  // Sync conversations`, stateReplacement);

const jsxReplacement = `        {/* 3.5 NOTIFICATIONS */}
        {notifications.length > 0 && (
          <div className="w-full flex flex-col gap-2.5 mt-2 mb-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5 font-mono">
                <Users className="w-3.5 h-3.5" />
                <span>Friend Requests ({notifications.length})</span>
              </span>
            </div>
            
            <div className="w-full flex flex-col gap-2">
              {notifications.map(notif => (
                <div key={notif.id} className="w-full p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full p-0.5 bg-rose-500/20 border border-rose-500/30 overflow-hidden flex items-center justify-center text-rose-300 font-bold text-base shrink-0 shadow-sm">
                      {notif.senderProfile?.avatarUrl ? (
                        <img
                          src={notif.senderProfile.avatarUrl}
                          alt={notif.senderProfile.fullName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span>{notif.senderProfile?.fullName?.charAt(0).toUpperCase() || notif.senderUsername.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">
                        {notif.senderProfile?.fullName || notif.senderUsername}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        wants to be your friend.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAcceptRequest(notif)}
                      className="flex-1 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold transition-colors border border-emerald-500/30"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleRejectRequest(notif)}
                      className="flex-1 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-xl text-xs font-bold transition-colors border border-rose-500/30"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. CONTENT AREA: DIRECT MESSAGES INBOX */}`;

code = code.replace(`        {/* 4. CONTENT AREA: DIRECT MESSAGES INBOX */}`, jsxReplacement);

fs.writeFileSync('src/components/InboxScreen.tsx', code);
