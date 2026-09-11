import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const socketRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!user || !token) {
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
      setSocket(null);
      setOnlineUsers([]);
      return;
    }

    // In production, keep Socket.IO same-origin with the API. In Vite dev,
    // connect straight to the backend so backend restarts do not flood the
    // Vite websocket proxy with ECONNRESET/ECONNREFUSED noise.
    const socketUrl = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://127.0.0.1:5000' : undefined);
    const s = io(socketUrl, { auth: { token }, transports: ['websocket', 'polling'] });

    s.on('connect', () => {});
    s.on('users:online', (users) => setOnlineUsers(users));
    s.on('typing:update', (data) => {
      setTypingUsers(prev => ({ ...prev, [data.user_id]: data }));
      setTimeout(() => setTypingUsers(prev => { const n = { ...prev }; delete n[data.user_id]; return n; }), 3000);
    });
    s.on('disconnect', () => {});

    socketRef.current = s;
    setSocket(s);

    return () => { s.disconnect(); };
  }, [user?.id]);

  const value = { socket, onlineUsers, typingUsers, isOnline: (userId) => onlineUsers.some(u => u.id === userId) };
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
