const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const { io: client } = require('socket.io-client');
const { app, db, waitForDb, cleanupTestDb } = require('./helpers');
const { initSocket } = require('../services/socket');
let server, io, url;
before(async () => {
  await waitForDb();
  await db.prepare('INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)').run('socket-user','User','socket@test.com','unused','student');
  server = http.createServer(app);
  io = initSocket(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve=>io.close(resolve)); cleanupTestDb(); });
function connect(id) {
  return client(url, { autoConnect: false, reconnection: false, transports: ['websocket'], auth: {token:jwt.sign({id,role:'admin'},process.env.JWT_SECRET,{expiresIn:'1h'})} });
}
test('socket uses current role and safely ignores malformed typing payloads', async () => {
  const socket = connect('socket-user');
  try {
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);socket.connect();});
    const peer = io.sockets.sockets.get(socket.id);
    assert.equal(peer.user.role,'student');
    assert.equal(peer.rooms.has('admins'),false);
    peer.on('security-check', ack => ack('ok'));
    socket.emit('typing:start',null);
    socket.emit('typing:stop');
    socket.emit('typing:start',{receiver_id:{bad:true}});
    const reply = await new Promise((resolve,reject)=>socket.timeout(2000).emit('security-check',(err,value)=>err?reject(err):resolve(value)));
    assert.equal(reply,'ok');
  } finally { socket.disconnect(); }
});
test('socket rejects signed tokens for deleted users', async () => {
  const socket = connect('deleted-user');
  try {
    const error = await new Promise(resolve=>{socket.once('connect_error',resolve);socket.connect();});
    assert.equal(error.message,'Invalid token');
  } finally { socket.disconnect(); }
});
