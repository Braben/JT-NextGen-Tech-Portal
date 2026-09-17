const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const onlineUsers = new Map();
let _io = null;

function getIO() { return _io; }

function initSocket(httpServer) {
  const allowedOrigins = (
    process.env.CORS_ORIGIN ||
    'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  _io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
        if (process.env.NODE_ENV !== 'production') return cb(null, true);
        return cb(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
    },
  });

  _io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('No token'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      const user = await db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(decoded.id);
      if (!user) return next(new Error('Invalid token'));
      socket.user = user;
      next();
    } catch { next(new Error('Invalid token')); }
  });

  _io.on('connection', (socket) => {
    const userId = socket.user.id;
    socket.join(`user:${userId}`);
    if (socket.user.role === 'admin') socket.join('admins');
    onlineUsers.set(userId, { id: userId, name: socket.user.name, role: socket.user.role, socketId: socket.id });
    _io.emit('users:online', Array.from(onlineUsers.keys()).map((id) => ({ id })));
    _io.to('admins').emit('users:online:admin', Array.from(onlineUsers.values()));

    // Messages and receipts are emitted only by the authenticated REST routes
    // after persistence; clients cannot fabricate delivery or read receipts.

    socket.on('typing:start', (data) => {
      if (!data || typeof data.receiver_id !== 'string' || data.receiver_id.length > 100) return;
      const { receiver_id } = data;
      _io.to(`user:${receiver_id}`).emit('typing:update', { user_id: userId, name: socket.user.name, typing: true });
    });

    socket.on('typing:stop', (data) => {
      if (!data || typeof data.receiver_id !== 'string' || data.receiver_id.length > 100) return;
      const { receiver_id } = data;
      _io.to(`user:${receiver_id}`).emit('typing:update', { user_id: userId, name: socket.user.name, typing: false });
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      _io.emit('users:online', Array.from(onlineUsers.keys()).map((id) => ({ id })));
      _io.to('admins').emit('users:online:admin', Array.from(onlineUsers.values()));
    });
  });

  return _io;
}

module.exports = { initSocket, getIO, onlineUsers };
