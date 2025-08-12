const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    methods: ["GET", "POST"],
  }
});

app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// --- Simple JSON file store for user accounts (no native build needed) ---
const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
const roomMessagesFile = path.join(dataDir, 'messages_rooms.json');
const dmMessagesFile = path.join(dataDir, 'messages_dm.json');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, JSON.stringify({ users: [] }, null, 2));
}
if (!fs.existsSync(roomMessagesFile)) {
  fs.writeFileSync(roomMessagesFile, JSON.stringify({}, null, 2));
}
if (!fs.existsSync(dmMessagesFile)) {
  fs.writeFileSync(dmMessagesFile, JSON.stringify({}, null, 2));
}

function readUsers() {
  try {
    const raw = fs.readFileSync(usersFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.users) ? parsed.users : [];
  } catch (e) {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify({ users }, null, 2));
}

function findUserByEmail(email) {
  const users = readUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

function findUserById(userId) {
  const users = readUsers();
  return users.find(u => String(u.id) === String(userId));
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function verifyAuthHeader(req) {
  const auth = req.headers.authorization || '';
  const [, token] = auth.split(' ');
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// --- Auth routes ---
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, avatar } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }
  const existing = findUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const nowIso = new Date().toISOString();
  const users = readUsers();
  const user = {
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    email: email.toLowerCase(),
    name,
    password_hash: passwordHash,
    avatar: avatar || null,
    created_at: nowIso,
  };
  users.push(user);
  writeUsers(users);
  const token = signToken({ userId: user.id, email: user.email, name: user.name });
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const user = findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken({ userId: user.id, email: user.email, name: user.name });
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar } });
});

app.get('/api/auth/me', (req, res) => {
  const payload = verifyAuthHeader(req);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  const user = findUserById(payload.userId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar } });
});

// --- Utility: messages storage ---
function readRoomMessages() {
  try {
    return JSON.parse(fs.readFileSync(roomMessagesFile, 'utf8')) || {};
  } catch (e) {
    return {};
  }
}

function writeRoomMessages(map) {
  fs.writeFileSync(roomMessagesFile, JSON.stringify(map, null, 2));
}

function readDmMessages() {
  try {
    return JSON.parse(fs.readFileSync(dmMessagesFile, 'utf8')) || {};
  } catch (e) {
    return {};
  }
}

function writeDmMessages(map) {
  fs.writeFileSync(dmMessagesFile, JSON.stringify(map, null, 2));
}

function conversationKey(userIdA, userIdB) {
  return [String(userIdA), String(userIdB)].sort().join('__');
}

// --- Public user directory (sanitized) ---
app.get('/api/users', (req, res) => {
  const users = readUsers().map(u => ({ id: u.id, name: u.name, avatar: u.avatar || '👤' }));
  res.json({ users });
});

// --- Chat history endpoints ---
app.get('/api/chat/room/:roomId', (req, res) => {
  const payload = verifyAuthHeader(req);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  const { roomId } = req.params;
  const limit = Math.min(parseInt(req.query.limit || '200', 10) || 200, 1000);
  const map = readRoomMessages();
  const list = Array.isArray(map[roomId]) ? map[roomId] : [];
  const start = Math.max(0, list.length - limit);
  return res.json({ messages: list.slice(start) });
});

app.get('/api/chat/dm/:peerUserId', (req, res) => {
  const payload = verifyAuthHeader(req);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  const { peerUserId } = req.params;
  const limit = Math.min(parseInt(req.query.limit || '200', 10) || 200, 1000);
  const key = conversationKey(payload.userId, peerUserId);
  const map = readDmMessages();
  const list = Array.isArray(map[key]) ? map[key] : [];
  const start = Math.max(0, list.length - limit);
  return res.json({ messages: list.slice(start) });
});

// Store connected users
const connectedUsers = new Map();

// Require auth via JWT in socket handshake
io.use((socket, next) => {
  const token = socket.handshake?.auth?.token;
  if (!token) return next(new Error('auth_required'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.data.userId = payload.userId;
    socket.data.name = payload.name;
    next();
  } catch (e) {
    next(new Error('invalid_token'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user joining
  socket.on('join-office', (userData) => {
    const dbUser = findUserById(socket.data.userId);
    const name = dbUser?.name || socket.data.name || userData.name;
    const avatar = userData.avatar || dbUser?.avatar || '👤';
    connectedUsers.set(socket.id, {
      id: socket.id,
      userId: socket.data.userId,
      name,
      avatar,
      position: userData.position,
      room: userData.room
    });
    
    // Broadcast to all users in the same room
    socket.join(userData.room);
    io.to(userData.room).emit('user-joined', {
      id: socket.id,
      name,
      avatar,
      position: userData.position,
      room: userData.room
    });
    
    // Send current users in the room to the new user
    const roomUsers = Array.from(connectedUsers.values()).filter(user => user.room === userData.room);
    socket.emit('room-users', roomUsers);
  });

  // Handle user movement
  socket.on('user-move', (data) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      const oldRoom = user.room;
      user.position = data.position;
      user.room = data.room;

      // If room changed, move socket between rooms and notify both rooms
      if (oldRoom !== data.room) {
        if (oldRoom) {
          socket.leave(oldRoom);
          io.to(oldRoom).emit('user-left', socket.id);
        }
        socket.join(data.room);
        io.to(data.room).emit('user-joined', {
          id: socket.id,
          name: user.name,
          avatar: user.avatar,
          position: data.position,
          room: data.room
        });
        // Send current users in the new room to the switching user
        const roomUsers = Array.from(connectedUsers.values()).filter(u => u.room === data.room && u.id !== socket.id);
        socket.emit('room-users', roomUsers);
      } else {
        // Broadcast movement to current room
        io.to(data.room).emit('user-moved', {
          id: socket.id,
          position: data.position,
          room: data.room
        });
      }
    }
  });

  // Handle chat messages
  socket.on('send-message', (messageData) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      const payload = {
        id: socket.id,
        userId: user.userId,
        name: user.name,
        avatar: user.avatar,
        room: user.room,
        message: messageData.message,
        timestamp: new Date().toISOString()
      };
      // Persist to room history (cap to last 500)
      const map = readRoomMessages();
      if (!Array.isArray(map[user.room])) map[user.room] = [];
      map[user.room].push(payload);
      if (map[user.room].length > 500) map[user.room] = map[user.room].slice(-500);
      writeRoomMessages(map);

      io.to(user.room).emit('new-message', payload);
    }
  });

  // Handle direct messages (DMs)
  socket.on('send-direct-message', (dmData) => {
    const sender = connectedUsers.get(socket.id);
    const toUserId = dmData?.toUserId;
    const text = dmData?.message;
    if (!sender || !toUserId || !text || !String(text).trim()) return;

    const senderProfile = findUserById(sender.userId) || { name: sender.name, avatar: sender.avatar };
    const recipientProfile = findUserById(toUserId) || { name: 'Unknown', avatar: '👤' };
    const timestamp = new Date().toISOString();

    const message = {
      fromSocketId: socket.id,
      fromUserId: sender.userId,
      fromName: senderProfile.name,
      fromAvatar: senderProfile.avatar,
      toUserId,
      toName: recipientProfile.name,
      toAvatar: recipientProfile.avatar,
      message: text,
      timestamp
    };

    // Persist
    const key = conversationKey(sender.userId, toUserId);
    const dmMap = readDmMessages();
    if (!Array.isArray(dmMap[key])) dmMap[key] = [];
    dmMap[key].push(message);
    if (dmMap[key].length > 500) dmMap[key] = dmMap[key].slice(-500);
    writeDmMessages(dmMap);

    // Deliver to recipient sockets (if online)
    const targetSocketIds = Array.from(connectedUsers.entries())
      .filter(([sid, u]) => u.userId === toUserId)
      .map(([sid]) => sid);
    if (targetSocketIds.length > 0) {
      io.to(targetSocketIds).emit('new-direct-message', message);
    }
    // Also echo to sender (for consistency across multiple tabs)
    const senderSocketIds = Array.from(connectedUsers.entries())
      .filter(([sid, u]) => u.userId === sender.userId)
      .map(([sid]) => sid);
    io.to(senderSocketIds).emit('new-direct-message', message);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      io.to(user.room).emit('user-left', socket.id);
      connectedUsers.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
