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
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, JSON.stringify({ users: [] }, null, 2));
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
      io.to(user.room).emit('new-message', {
        id: socket.id,
        name: user.name,
        message: messageData.message,
        timestamp: new Date().toISOString()
      });
    }
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
