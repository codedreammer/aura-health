import { getRelativeTimestamp } from '../utils/notifications.js';

const notificationIcons = {
  welcome: '✨',
  achievement: '🌿',
  reminder: '💊',
  hydration: '💧',
  tip: '💡',
};

export default function NotificationPanel({ notifications, onMarkAsRead, onMarkAllAsRead, onClearAll }) {
  return (
    <div className="absolute right-0 top-10 z-20 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-black/5 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
        <div><p className="text-sm font-bold">Aura notifications</p><p className="text-[11px] text-[#16302B]/50">A little support for your day</p></div>
        {notifications.length > 0 && <button onClick={onClearAll} className="text-xs font-semibold text-[#1F7A63]">Clear all</button>}
      </div>
      {notifications.length > 0 && <div className="flex justify-end px-4 pt-2"><button onClick={onMarkAllAsRead} className="text-[11px] font-semibold text-[#16302B]/50">Mark all as read</button></div>}
      <div className="max-h-96 overflow-y-auto px-2 py-2">
        {notifications.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-[#16302B]/45">You are all caught up. Aura will be here when there is something new.</p>
        ) : notifications.map((notification) => (
          <button key={notification.id} onClick={() => onMarkAsRead(notification.id)} className={`w-full rounded-xl px-3 py-3 text-left transition-colors ${notification.read ? 'bg-white' : 'bg-[#DCEEE7]/45 hover:bg-[#DCEEE7]/70'}`}>
            <div className="flex gap-3">
              <span className="mt-0.5 text-base">{notificationIcons[notification.type] || '✨'}</span>
              <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-xs font-bold text-[#16302B]">{notification.title}</p>{!notification.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F0784A]" />}</div><p className="mt-1 text-xs leading-relaxed text-[#16302B]/65">{notification.body}</p><p className="mt-1.5 text-[10px] text-[#16302B]/40">{getRelativeTimestamp(notification.createdAt)}</p></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
