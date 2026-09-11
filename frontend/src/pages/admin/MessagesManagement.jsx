/**
 * MessagesManagement - Admin page for viewing and managing messages
 *
 * Features:
 * - List of conversations
 * - View message threads
 * - Send new messages
 * - Search and filter
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, MessageSquare, Send, ChevronLeft, Inbox, Users } from 'lucide-react';
import { messageAPI } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import { Card, Button, Modal, Textarea, Select } from '../../components/ui';

const maxMessageLength = 4000;

export default function MessagesManagement() {
  const { toast } = useToast();
  const { socket } = useSocket();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showCompose, setShowCompose] = useState(false);
  const [composeForm, setComposeForm] = useState({ recipient_id: '', content: '' });
  const [sending, setSending] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const [replyContent, setReplyContent] = useState('');

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const [convRes, usersRes] = await Promise.all([
        messageAPI.getConversations(),
        messageAPI.getUsers(),
      ]);
      setConversations(convRes.data || []);
      setUsers(usersRes.data || []);
    } catch (err) {
      toast('Failed to load messages', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get('action') === 'compose') setShowCompose(true);
  }, [location.search]);

  useEffect(() => {
    if (!socket) return;
    socket.on('messages:new', fetchConversations);
    socket.on('messages:read_receipt', fetchConversations);
    return () => {
      socket.off('messages:new', fetchConversations);
      socket.off('messages:read_receipt', fetchConversations);
    };
  }, [socket, fetchConversations]);

  const handleSelectConversation = async (conv) => {
    setSelectedConversation(conv);
    try {
      const res = await messageAPI.getMessages(conv.id);
      setMessages(res.data.messages || []);
      await messageAPI.markRead(conv.id);
      setConversations((current) => current.map(c => c.id === conv.id ? { ...c, unread: 0 } : c));
    } catch (err) {
      toast('Failed to load messages', 'error');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const content = composeForm.content.trim();
    if (!composeForm.recipient_id || !content) {
      toast('Recipient and message are required', 'warning');
      return;
    }
    if (content.length > maxMessageLength) {
      toast(`Messages must be ${maxMessageLength.toLocaleString()} characters or fewer`, 'warning');
      return;
    }
    setSending(true);
    try {
      await messageAPI.send(composeForm.recipient_id, content);
      toast('Message sent', 'success');
      setShowCompose(false);
      setComposeForm({ recipient_id: '', content: '' });
      fetchConversations();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    const content = replyContent.trim();
    if (!selectedConversation || !content) return;
    if (content.length > maxMessageLength) {
      toast(`Messages must be ${maxMessageLength.toLocaleString()} characters or fewer`, 'warning');
      return;
    }
    setReplySending(true);
    try {
      await messageAPI.send(selectedConversation.id, content);
      const res = await messageAPI.getMessages(selectedConversation.id);
      setMessages(res.data.messages || []);
      setReplyContent('');
      fetchConversations();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to send reply', 'error');
    } finally {
      setReplySending(false);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.last_message?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unreadTotal = useMemo(() => conversations.reduce((total, item) => total + Number(item.unread || 0), 0), [conversations]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Messages</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">View and manage messages</p>
        </div>
        <Button onClick={() => setShowCompose(true)} icon={MessageSquare}>
          Compose
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard icon={Inbox} label="Conversations" value={conversations.length} />
        <SummaryCard icon={MessageSquare} label="Unread Messages" value={unreadTotal} />
        <SummaryCard icon={Users} label="Available Users" value={users.length} />
      </div>

      <div className="card flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <Card className="lg:col-span-1 h-full flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Conversations</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3 p-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                    <div className="flex-1"><div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" /><div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded mt-1" /></div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="font-medium">No conversations found</p>
                <p className="mt-1 text-sm">Compose a message or change your search.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full p-4 text-left flex items-center gap-3 transition-colors ${
                      selectedConversation?.id === conv.id
                        ? 'bg-brand-50 dark:bg-brand-900/20 border-l-4 border-brand-500'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-brand-600 dark:text-brand-400 font-medium">{conv.name?.charAt(0) || 'U'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{conv.name}</p>
                        {Number(conv.unread || 0) > 0 && (
                          <span className="min-w-[1.25rem] h-5 rounded-full bg-brand-500 px-1.5 text-white text-xs flex items-center justify-center">{Number(conv.unread) > 9 ? '9+' : conv.unread}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{conv.last_message || 'No messages yet'}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Message Thread */}
        <Card className="lg:col-span-2 h-full flex flex-col">
          {selectedConversation ? (
            <>
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedConversation(null)} className="lg:hidden p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeft className="w-5 h-5" /></button>
                  <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                    <span className="text-brand-600 dark:text-brand-400 font-medium">{selectedConversation.name?.charAt(0) || 'U'}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedConversation.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{selectedConversation.email}</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: '500px' }}>
                {messages.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">No messages yet</p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender_id === selectedConversation.id ? 'justify-start' : 'justify-end'}`}>
                      <div className={`min-w-0 max-w-[85%] sm:max-w-[70%] [overflow-wrap:anywhere] p-3 rounded-2xl ${msg.sender_id === selectedConversation.id ? 'bg-gray-100 dark:bg-gray-700 rounded-tl-md' : 'bg-brand-500 text-white rounded-tr-md'}`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={`text-xs mt-1 ${msg.sender_id === selectedConversation.id ? 'text-gray-400' : 'text-brand-100'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <form onSubmit={handleReply} className="flex gap-2">
                  <input
                    type="text"
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    maxLength={maxMessageLength}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <Button type="submit" icon={Send} size="sm" loading={replySending} disabled={!replyContent.trim()}>Send</Button>
                </form>
                <p className="mt-1 text-right text-[11px] text-gray-400">{replyContent.length}/{maxMessageLength.toLocaleString()}</p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Compose Modal */}
      <Modal isOpen={showCompose} onClose={() => { setShowCompose(false); setComposeForm({ recipient_id: '', content: '' }); }} title="New Message" size="lg">
          <form onSubmit={handleSendMessage} className="space-y-4">
            <Select label="Recipient *" value={composeForm.recipient_id} onChange={(e) => setComposeForm({ ...composeForm, recipient_id: e.target.value })} options={[{value:'',label:'Select user'}, ...users.map(u => ({value:u.id,label:`${u.name} (${u.email})`}))]} required />
            <Textarea label="Message *" value={composeForm.content} onChange={(e) => setComposeForm({ ...composeForm, content: e.target.value })} rows={5} required maxLength={maxMessageLength} helperText={`${composeForm.content.length}/${maxMessageLength.toLocaleString()} characters`} placeholder="Type your message..." />
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="button" variant="secondary" onClick={() => { setShowCompose(false); setComposeForm({ recipient_id: '', content: '' }); }}>
                Cancel
              </Button>
              <Button type="submit" loading={sending}>Send Message</Button>
            </div>
          </form>
        </Modal>
     </div>
  );
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="card flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
