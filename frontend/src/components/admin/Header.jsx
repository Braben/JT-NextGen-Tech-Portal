import { useCallback, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  MessageSquare,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Calendar,
} from 'lucide-react';
import { messageAPI, notificationAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

const academicPeriods = [
  { value: '2024-2025', label: '2024 - 2025 Academic Year' },
  { value: '2023-2024', label: '2023 - 2024 Academic Year' },
  { value: '2022-2023', label: '2022 - 2023 Academic Year' },
];

export default function Header({ title = 'Admin Dashboard', subtitle = 'Full system management and control', onSidebarToggle }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [messages, setMessages] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('2024-2025');
  const notificationsRef = useRef(null);
  const messagesRef = useRef(null);
  const userMenuRef = useRef(null);

  const fetchHeaderActivity = useCallback(async () => {
    if (!user) return;
    try {
      const [notificationCountRes, notificationRes, conversationRes] = await Promise.all([
        notificationAPI.unreadCount(),
        notificationAPI.getAll(),
        messageAPI.getConversations(),
      ]);
      const conversations = conversationRes.data || [];
      setUnreadNotifications(Number(notificationCountRes.data.count || 0));
      setNotifications((notificationRes.data || []).slice(0, 5));
      setUnreadMessages(conversations.reduce((total, item) => total + Number(item.unread || 0), 0));
      setMessages(conversations.slice(0, 5));
    } catch {
      // Header badges are opportunistic; keep the header interactive and let
      // polling/socket refresh repair transient API failures.
    }
  }, [user]);

  useEffect(() => {
    fetchHeaderActivity();
    const interval = setInterval(fetchHeaderActivity, 30000);
    return () => clearInterval(interval);
  }, [fetchHeaderActivity]);

  useEffect(() => {
    if (!socket) return;
    socket.on('notifications:new', fetchHeaderActivity);
    socket.on('messages:new', fetchHeaderActivity);
    socket.on('messages:read_receipt', fetchHeaderActivity);
    return () => {
      socket.off('notifications:new', fetchHeaderActivity);
      socket.off('messages:new', fetchHeaderActivity);
      socket.off('messages:read_receipt', fetchHeaderActivity);
    };
  }, [socket, fetchHeaderActivity]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (messagesRef.current && !messagesRef.current.contains(event.target)) {
        setShowMessages(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  const roleBase = user?.role === 'admin' ? '/admin' : user?.role === 'instructor' ? '/instructor' : user?.role === 'student' ? '/student' : '';
  const messagesPath = roleBase ? `${roleBase}/messages` : '/messages';
  const profilePath = user?.role === 'admin' ? '/admin/account' : roleBase ? `${roleBase}/profile` : '/profile';
  const notificationSettingsPath = user?.role === 'admin' ? '/admin/notifications' : '/notifications/settings';

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.read) {
        await notificationAPI.markRead(notification.id);
        setUnreadNotifications((count) => Math.max(0, count - 1));
        setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read: 1 } : item));
      }
      if (notification.target_url) navigate(notification.target_url);
      setShowNotifications(false);
    } catch {
      fetchHeaderActivity();
    }
  };

  const handleMarkAllNotifications = async () => {
    try {
      await notificationAPI.markAllRead();
      setUnreadNotifications(0);
      setNotifications((items) => items.map((item) => ({ ...item, read: 1 })));
    } catch {
      fetchHeaderActivity();
    }
  };

  const openMessages = () => {
    setShowMessages(false);
    navigate(messagesPath);
  };

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onSidebarToggle}
            aria-label="Toggle sidebar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="hidden sm:block flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search students, programs, courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                aria-label="Global search"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <Calendar className="w-4 h-4 text-gray-400" aria-hidden="true" />
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="text-sm bg-transparent border-none focus:outline-none text-gray-700 dark:text-gray-200 cursor-pointer"
                aria-label="Academic period"
              >
                {academicPeriods.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => { setShowNotifications(!showNotifications); setShowMessages(false); setShowUserMenu(false); }}
              className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={`Notifications${unreadNotifications > 0 ? `, ${unreadNotifications} unread` : ''}`}
              aria-expanded={showNotifications}
            >
              <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" aria-hidden="true" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden animate-slide-in-right">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                  <div className="flex items-center gap-3">
                    {unreadNotifications > 0 && (
                      <button onClick={handleMarkAllNotifications} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                        Mark all read
                      </button>
                    )}
                    <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close notifications">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">No notifications</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`block w-full px-4 py-3 text-left border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${!n.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      >
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{n.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(n.created_at)}</p>
                      </button>
                    ))
                  )}
                </div>
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                  <button onClick={() => { setShowNotifications(false); navigate(notificationSettingsPath); }} className="w-full text-sm text-brand-600 hover:text-brand-700 font-medium">Notification settings</button>
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={messagesRef}>
            <button
              onClick={() => { setShowMessages(!showMessages); setShowNotifications(false); setShowUserMenu(false); }}
              className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={`Messages${unreadMessages > 0 ? `, ${unreadMessages} unread` : ''}`}
              aria-expanded={showMessages}
            >
              <MessageSquare className="w-5 h-5 text-gray-600 dark:text-gray-300" aria-hidden="true" />
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>

            {showMessages && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden animate-slide-in-right">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Messages</h3>
                  <button onClick={() => setShowMessages(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close messages">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {messages.length === 0 ? (
                    <p className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">No messages</p>
                  ) : (
                    messages.map((m) => (
                      <button
                        key={m.id}
                        onClick={openMessages}
                        className={`block w-full px-4 py-3 text-left border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${Number(m.unread || 0) > 0 ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{m.name}</p>
                          {Number(m.unread || 0) > 0 && (
                            <span className="min-w-[1.25rem] h-5 rounded-full bg-green-500 px-1.5 text-xs font-semibold text-white flex items-center justify-center">
                              {Number(m.unread) > 9 ? '9+' : m.unread}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{m.last_message || 'No message preview'}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(m.last_message_at)}</p>
                      </button>
                    ))
                  )}
                </div>
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                  <button onClick={openMessages} className="w-full text-sm text-brand-600 hover:text-brand-700 font-medium">View all messages</button>
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); setShowMessages(false); }}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="User menu"
              aria-expanded={showUserMenu}
            >
              <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                <User className="w-5 h-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[120px]">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role || 'User'}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 hidden md:block" aria-hidden="true" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden animate-slide-in-right">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <p className="font-medium text-sm text-gray-900 dark:text-white">{user?.name || 'User'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email || ''}</p>
                </div>
                <nav className="py-2">
                  <a href={profilePath} className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setShowUserMenu(false)}>
                    <Settings className="w-5 h-5" aria-hidden="true" />
                    Account Settings
                  </a>
                  <a href={notificationSettingsPath} className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setShowUserMenu(false)}>
                    <Bell className="w-5 h-5" aria-hidden="true" />
                    Notification Settings
                  </a>
                </nav>
                <div className="border-t border-gray-200 dark:border-gray-700 py-2">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <LogOut className="w-5 h-5" aria-hidden="true" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="lg:hidden border-t border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
      </div>
    </header>
  );
}

function formatRelativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
}
