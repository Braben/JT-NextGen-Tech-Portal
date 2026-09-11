import { useCallback, useState, useEffect, useRef } from 'react';
import { notificationAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef(null);
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const [countRes, listRes] = await Promise.all([
        notificationAPI.unreadCount(),
        notificationAPI.getAll(),
      ]);
      setUnread(Number(countRes.data.count || 0));
      setNotifications(listRes.data || []);
      setError('');
    } catch {
      setError('Notifications could not be refreshed. Please try again.');
      // Silent refresh failures keep the header usable while the next poll or
      // socket event gets another chance to sync badge state.
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (!socket) return;
    const onNew = () => fetchNotifications();
    socket.on('notifications:new', onNew);
    socket.on('notifications:updated', onNew);
    socket.on('connect', onNew);
    return () => {
      socket.off('notifications:new', onNew);
      socket.off('notifications:updated', onNew);
      socket.off('connect', onNew);
    };
  }, [socket, fetchNotifications]);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMarkRead = async (notification) => {
    if (!notification) return;
    try {
      if (!notification.read) {
        await notificationAPI.markRead(notification.id);
        setUnread((u) => Math.max(0, u - 1));
        setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read: 1 } : item));
      }
      if (notification.target_url) {
        setOpen(false);
        navigate(notification.target_url);
      }
    } catch {
      fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setUnread(0);
      setNotifications((items) => items.map((item) => ({ ...item, read: 1 })));
    } catch {
      fetchNotifications();
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-label={`Notifications, ${unread} unread`} aria-expanded={open} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }} onClick={() => setOpen(!open)} className="relative p-2 text-gray-600 hover:text-brand-700 transition-colors rounded-lg hover:bg-gray-50">
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-2 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:mt-0 sm:w-80 sm:top-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100">Notifications</h3>
            {unread > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-brand-600 hover:text-brand-800 font-medium">Mark all read</button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {error && <div role="alert" className="p-3 text-sm text-red-700"><p>{error}</p><button type="button" onClick={fetchNotifications} className="underline">Retry</button></div>}
            {notifications.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No notifications</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleMarkRead(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${!n.read ? 'bg-brand-50/50 dark:bg-brand-900/20' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${!n.read ? 'bg-brand-500' : 'bg-transparent'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
