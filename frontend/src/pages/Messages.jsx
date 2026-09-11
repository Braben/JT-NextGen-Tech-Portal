import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  ChevronLeft,
  MessageSquare,
  Search,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import { messageAPI, notificationAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

const maxMessageLength = 4000;

export default function Messages() {
  const { userId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, typingUsers, isOnline } = useSocket();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState(new URLSearchParams(location.search).get('tab') === 'announcements' ? 'announcements' : 'direct');
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [partner, setPartner] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [content, setContent] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const inboxRoot = useMemo(() => {
    if (location.pathname.startsWith('/student/messages')) return '/student/messages';
    if (location.pathname.startsWith('/instructor/messages')) return '/instructor/messages';
    return '/messages';
  }, [location.pathname]);

  useEffect(() => {
    setActiveTab(new URLSearchParams(location.search).get('tab') === 'announcements' ? 'announcements' : 'direct');
  }, [location.search]);

  useEffect(() => {
    if (activeTab !== 'announcements') return;
    const unread = announcements.filter((item) => Number(item.read || 0) === 0);
    if (!unread.length) return;
    // Opening the announcements tab is an intentional read action. Marking the
    // visible copies read keeps the bell badge and announcement list in sync.
    Promise.all(unread.map((item) => notificationAPI.markRead(item.id))).catch(() => {});
    setAnnouncements((current) => current.map((item) => ({ ...item, read: 1 })));
  }, [activeTab, announcements]);

  const goToTab = (tab) => {
    setActiveTab(tab);
    navigate(tab === 'announcements' ? `${inboxRoot}?tab=announcements` : inboxRoot);
  };

  const refreshConversations = useCallback(async () => {
    try {
      const res = await messageAPI.getConversations();
      setConversations(res.data || []);
    } catch {
      toast('Could not refresh conversations', 'error');
    }
  }, [toast]);

  const loadAnnouncements = useCallback(async () => {
    setAnnouncementLoading(true);
    try {
      const res = await notificationAPI.getAll();
      setAnnouncements((res.data || []).filter((item) => item.type === 'announcement'));
    } catch {
      toast('Could not load announcements', 'error');
    } finally {
      setAnnouncementLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    Promise.all([messageAPI.getConversations(), messageAPI.getUsers(), notificationAPI.getAll()])
      .then(([conversationRes, userRes, notificationRes]) => {
        setConversations(conversationRes.data || []);
        setUsers(userRes.data || []);
        setAnnouncements((notificationRes.data || []).filter((item) => item.type === 'announcement'));
      })
      .catch(() => toast('Failed to load inbox', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  const loadMessages = useCallback(async (uid, offset = 0) => {
    setThreadLoading(offset === 0);
    try {
      const res = await messageAPI.getMessages(uid, { offset, limit: 50 });
      if (offset === 0) {
        setMessages(res.data.messages || []);
        setPartner(res.data.partner || null);
      } else {
        setMessages((current) => [...(res.data.messages || []), ...current]);
      }
      setTotalMessages(res.data.total || 0);
    } catch {
      toast('Could not load this conversation', 'error');
    } finally {
      setThreadLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!userId) {
      setMessages([]);
      setPartner(null);
      return;
    }
    setActiveTab('direct');
    setMessages([]);
    setSearchResults([]);
    setMessageSearch('');
    setTotalMessages(0);
    loadMessages(userId, 0);
    messageAPI.getUnreadCounts()
      .then((res) => setConversations((current) => current.map((item) => ({ ...item, unread: res.data[item.id] || 0 }))))
      .catch(() => {});
    socket?.emit('messages:read', { sender_id: userId });
  }, [loadMessages, socket, userId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || messages.length >= totalMessages || !userId) return;
    setLoadingMore(true);
    await loadMessages(userId, messages.length);
    setLoadingMore(false);
  }, [loadMessages, loadingMore, messages.length, totalMessages, userId]);

  useEffect(() => {
    const element = messagesContainerRef.current;
    if (!element || !userId) return undefined;
    const onScroll = () => {
      if (element.scrollTop < 50 && messages.length < totalMessages) loadMore();
    };
    element.addEventListener('scroll', onScroll);
    return () => element.removeEventListener('scroll', onScroll);
  }, [loadMore, messages.length, totalMessages, userId]);

  useEffect(() => {
    if (!socket || !user?.id) return undefined;

    const onNewMessage = (data) => {
      const isCurrentChat = (
        (data.sender_id === userId && data.receiver_id === user.id) ||
        (data.sender_id === user.id && data.receiver_id === userId)
      );
      const isIncomingUnread = data.receiver_id === user.id && data.sender_id !== user.id && !isCurrentChat;

      if (isCurrentChat) {
        setMessages((current) => [...current, data]);
        if (data.sender_id !== user.id) {
          messageAPI.markRead(data.sender_id).catch(() => {});
          socket.emit('messages:read', { sender_id: data.sender_id });
        }
      }

      setConversations((current) => current.map((conversation) => {
        if (conversation.id !== data.sender_id && conversation.id !== data.receiver_id) return conversation;
        return {
          ...conversation,
          last_message: data.content,
          last_message_at: data.created_at,
          unread: Number(conversation.unread || 0) + (isIncomingUnread ? 1 : 0),
        };
      }));
      refreshConversations();
    };

    const onReadReceipt = (data) => {
      if (data?.read_by !== userId) return;
      setMessages((current) => current.map((item) => (item.sender_id === user.id ? { ...item, is_read: 1 } : item)));
    };

    const onAnnouncement = () => loadAnnouncements();

    socket.on('messages:new', onNewMessage);
    socket.on('messages:read_receipt', onReadReceipt);
    socket.on('notification:new', onAnnouncement);
    socket.on('notifications:new', onAnnouncement);
    return () => {
      socket.off('messages:new', onNewMessage);
      socket.off('messages:read_receipt', onReadReceipt);
      socket.off('notification:new', onAnnouncement);
      socket.off('notifications:new', onAnnouncement);
    };
  }, [loadAnnouncements, refreshConversations, socket, user?.id, userId]);

  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1]?.sender_id !== user.id) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, user?.id]);

  const filteredConversations = useMemo(() => {
    const query = userSearch.toLowerCase();
    return conversations.filter((item) => (
      !query ||
      item.name?.toLowerCase().includes(query) ||
      item.role?.toLowerCase().includes(query) ||
      item.last_message?.toLowerCase().includes(query)
    ));
  }, [conversations, userSearch]);

  const availableUsers = useMemo(() => {
    const query = userSearch.toLowerCase();
    return users.filter((item) => (
      !conversations.some((conversation) => conversation.id === item.id) &&
      (!query || item.name?.toLowerCase().includes(query) || item.role?.toLowerCase().includes(query))
    ));
  }, [conversations, userSearch, users]);

  const unreadTotal = conversations.reduce((total, item) => total + Number(item.unread || 0), 0);
  const isTyping = Boolean(userId && typingUsers[userId]);

  const handleSend = async () => {
    const cleanContent = content.trim();
    if (!cleanContent || !userId || sending) return;
    if (cleanContent.length > maxMessageLength) {
      toast(`Messages must be ${maxMessageLength.toLocaleString()} characters or fewer`, 'warning');
      return;
    }

    setSending(true);
    try {
      const res = await messageAPI.send(userId, cleanContent);
      const message = { ...res.data, sender_name: user.name, sender_avatar: user.avatar };
      setMessages((current) => [...current, message]);
      setContent('');
      setConversations((current) => current.map((item) => (
        item.id === userId ? { ...item, last_message: message.content, last_message_at: message.created_at, unread: 0 } : item
      )));
      refreshConversations();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId) => {
    const ok = await confirm('Delete this message?', { danger: true, title: 'Delete message', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await messageAPI.delete(messageId);
      setMessages((current) => current.filter((item) => item.id !== messageId));
      toast('Message deleted', 'info');
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to delete message', 'error');
    }
  };

  const handleSearch = async (value) => {
    setMessageSearch(value);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await messageAPI.search({ q: value, with: userId });
      setSearchResults(res.data || []);
    } catch {
      toast('Message search failed', 'error');
    }
  };

  const handleTyping = (value) => {
    if (!socket || !userId) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit(value ? 'typing:start' : 'typing:stop', { receiver_id: userId });
    if (value) typingTimeoutRef.current = setTimeout(() => socket.emit('typing:stop', { receiver_id: userId }), 2000);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inbox</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Direct conversations and announcements in one place</p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
          <TabButton active={activeTab === 'direct'} onClick={() => goToTab('direct')} icon={MessageSquare}>
            Messages {unreadTotal > 0 ? `(${unreadTotal > 9 ? '9+' : unreadTotal})` : ''}
          </TabButton>
          <TabButton active={activeTab === 'announcements'} onClick={() => goToTab('announcements')} icon={Bell}>
            Announcements
          </TabButton>
        </div>
      </div>

      {activeTab === 'announcements' ? (
        <AnnouncementsPanel announcements={announcements} loading={announcementLoading} />
      ) : (
        <div className="flex h-[calc(100vh-12rem)] min-h-[620px] gap-4">
          <aside className={`${userId ? 'hidden lg:flex' : 'flex'} w-full flex-shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white lg:w-[22rem] dark:border-gray-700 dark:bg-gray-900`}>
            <div className="border-b border-gray-100 p-3 dark:border-gray-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search people or messages..."
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ConversationSection title="Recent Conversations" empty="No active conversations">
                {filteredConversations.map((conversation) => (
                  <ConversationButton
                    key={conversation.id}
                    conversation={conversation}
                    active={userId === conversation.id}
                    online={isOnline(conversation.id)}
                    onClick={() => navigate(`${inboxRoot}/${conversation.id}`)}
                  />
                ))}
              </ConversationSection>
              <ConversationSection title="Start a Conversation" empty={availableUsers.length ? '' : 'No matching users'}>
                {availableUsers.map((item) => (
                  <UserButton
                    key={item.id}
                    user={item}
                    online={isOnline(item.id)}
                    onClick={() => navigate(`${inboxRoot}/${item.id}`)}
                  />
                ))}
              </ConversationSection>
            </div>
          </aside>

          <main className={`${userId ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900`}>
            {userId && partner ? (
              <>
                <header className="flex items-center gap-3 border-b border-gray-100 p-3 dark:border-gray-800">
                  <button onClick={() => navigate(inboxRoot)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden dark:hover:bg-gray-800" aria-label="Back to conversations">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <Avatar name={partner.name} online={isOnline(partner.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900 dark:text-white">{partner.name}</p>
                    <p className="text-xs capitalize text-gray-500 dark:text-gray-400">{isOnline(partner.id) ? 'Online' : 'Offline'} / {partner.role}</p>
                  </div>
                  <div className="relative hidden sm:block">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                    <input
                      type="search"
                      placeholder="Search thread..."
                      value={messageSearch}
                      onChange={(event) => handleSearch(event.target.value)}
                      className="w-44 rounded-lg border border-gray-200 py-1.5 pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </header>

                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4">
                  {threadLoading && messages.length === 0 ? (
                    <LoadingSpinner compact />
                  ) : messageSearch ? (
                    <SearchResults results={searchResults} clear={() => handleSearch('')} />
                  ) : (
                    <>
                      {loadingMore && <p className="py-2 text-center text-xs text-gray-400">Loading older messages...</p>}
                      {messages.length === 0 ? (
                        <EmptyState icon={MessageSquare} title="No messages yet" body={`Start the conversation with ${partner.name}.`} />
                      ) : (
                        <MessageList messages={messages} userId={user.id} onDelete={handleDelete} />
                      )}
                      <div ref={messagesEndRef} />
                      {isTyping && <TypingIndicator name={partner.name} />}
                    </>
                  )}
                </div>

                <footer className="border-t border-gray-100 p-3 dark:border-gray-800">
                  <form onSubmit={(event) => { event.preventDefault(); handleSend(); }} className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        placeholder="Type a message..."
                        value={content}
                        maxLength={maxMessageLength}
                        onChange={(event) => { setContent(event.target.value); handleTyping(event.target.value.length > 0); }}
                        onBlur={() => handleTyping(false)}
                      />
                      <button type="submit" disabled={!content.trim() || sending} className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-brand-600 px-3 text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Send message">
                        {sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Send className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-right text-[11px] text-gray-400">{content.length}/{maxMessageLength.toLocaleString()}</p>
                  </form>
                </footer>
              </>
            ) : (
              <EmptyConversation inboxRoot={inboxRoot} />
            )}
          </main>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </button>
  );
}

function ConversationSection({ title, empty, children }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section>
      <div className="px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</div>
      {hasChildren ? children : <p className="px-3 py-4 text-sm text-gray-400">{empty}</p>}
    </section>
  );
}

function ConversationButton({ conversation, active, online, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 border-b border-gray-50 p-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60 ${active ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}>
      <Avatar name={conversation.name} online={online} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{conversation.name}</span>
          {Number(conversation.unread || 0) > 0 && <Badge count={conversation.unread} />}
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{conversation.last_message || 'No messages yet'}</p>
      </div>
    </button>
  );
}

function UserButton({ user, online, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 border-b border-gray-50 p-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60">
      <Avatar name={user.name} online={online} muted />
      <div className="min-w-0">
        <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">{user.name}</span>
        <span className="text-xs capitalize text-gray-400">{user.role}</span>
      </div>
    </button>
  );
}

function Avatar({ name, online, muted = false }) {
  return (
    <div className="relative shrink-0">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${muted ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' : 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'}`}>
        {name?.charAt(0)?.toUpperCase() || 'U'}
      </div>
      {online && <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 dark:border-gray-900" />}
    </div>
  );
}

function Badge({ count }) {
  return <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">{Number(count) > 9 ? '9+' : count}</span>;
}

function MessageList({ messages, userId, onDelete }) {
  const rows = [];
  let currentDate = null;
  messages.forEach((message) => {
    const date = new Date(message.created_at).toLocaleDateString();
    if (date !== currentDate) {
      rows.push({ type: 'date', date });
      currentDate = date;
    }
    rows.push({ type: 'message', data: message });
  });

  return (
    <div className="space-y-2">
      {rows.map((row, index) => {
        if (row.type === 'date') return <DateDivider key={`date-${row.date}-${index}`} date={row.date} />;
        return <MessageBubble key={row.data.id} message={row.data} mine={row.data.sender_id === userId} onDelete={onDelete} />;
      })}
    </div>
  );
}

function MessageBubble({ message, mine, onDelete }) {
  return (
    <div className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`relative max-w-[78%] rounded-2xl px-4 py-2.5 ${mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'}`}>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
        <div className={`mt-1 flex items-center gap-1 ${mine ? 'justify-end text-brand-100' : 'justify-start text-gray-400'}`}>
          <span className="text-xs">{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {mine && <CheckCheck className={`h-3.5 w-3.5 ${message.is_read ? 'opacity-100' : 'opacity-45'}`} aria-label={message.is_read ? 'Read' : 'Sent'} />}
        </div>
        {mine && (
          <button type="button" onClick={() => onDelete(message.id)} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-sm transition-opacity hover:bg-red-600 group-hover:opacity-100" aria-label="Delete message">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function DateDivider({ date }) {
  const today = new Date().toLocaleDateString();
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();
  const label = date === today ? 'Today' : date === yesterday ? 'Yesterday' : date;
  return (
    <div className="flex items-center gap-3 py-2">
      <hr className="flex-1 border-gray-100 dark:border-gray-800" />
      <span className="text-xs text-gray-400">{label}</span>
      <hr className="flex-1 border-gray-100 dark:border-gray-800" />
    </div>
  );
}

function SearchResults({ results, clear }) {
  if (results.length === 0) {
    return <EmptyState icon={Search} title="No matches" body="Try a different word or clear the thread search." action={<button type="button" onClick={clear} className="text-sm font-medium text-brand-600">Clear search</button>} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Search results ({results.length})</p>
        <button type="button" onClick={clear} className="text-sm font-medium text-brand-600">Clear</button>
      </div>
      {results.map((message) => (
        <div key={message.id} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm leading-6 text-gray-800 dark:text-gray-100">{message.content}</p>
          <p className="mt-1 text-xs text-gray-400">{new Date(message.created_at).toLocaleString()} / {message.direction === 'sent' ? 'You' : message.sender_name}</p>
        </div>
      ))}
    </div>
  );
}

function AnnouncementsPanel({ announcements, loading }) {
  if (loading) return <LoadingSpinner />;
  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="border-b border-gray-100 p-4 dark:border-gray-800">
        <h2 className="font-semibold text-gray-900 dark:text-white">Announcements</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Important updates sent by the admin team</p>
      </div>
      {announcements.length === 0 ? (
        <EmptyState icon={Bell} title="No announcements" body="Announcements from the admin team will appear here." />
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {announcements.map((announcement) => (
            <article key={announcement.id} className={`p-4 ${Number(announcement.read || 0) === 0 ? 'bg-brand-50/60 dark:bg-brand-900/10' : ''}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white">{announcement.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300">{announcement.message}</p>
                </div>
                {Number(announcement.read || 0) === 0 && <span className="w-fit rounded-full bg-brand-600 px-2 py-1 text-xs font-semibold text-white">New</span>}
              </div>
              <p className="mt-3 text-xs text-gray-400">{new Date(announcement.created_at).toLocaleString()}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function TypingIndicator({ name }) {
  return (
    <div className="flex items-center gap-2 pl-2 pt-2 text-xs text-gray-400">
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
      </div>
      {name} is typing...
    </div>
  );
}

function EmptyConversation({ inboxRoot }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-gray-500 dark:text-gray-400">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
          <MessageSquare className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="font-semibold text-gray-900 dark:text-white">Select a conversation</p>
        <p className="mt-1 text-sm">Choose someone from the inbox or start a new conversation.</p>
        <Link to={inboxRoot} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-600 lg:hidden">
          <ArrowLeft className="h-4 w-4" /> Back to inbox
        </Link>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center p-8 text-center">
      <div>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-800">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{body}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

function LoadingSpinner({ compact = false }) {
  return (
    <div className={`flex items-center justify-center ${compact ? 'py-10' : 'py-20'}`}>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
    </div>
  );
}
