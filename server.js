const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
// LiveKit server SDK for issuing access tokens
let LivekitServerSdk;
try {
  LivekitServerSdk = require('livekit-server-sdk');
} catch (e) {
  LivekitServerSdk = null;
}

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
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://work-together-o49u1784.livekit.cloud';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'APIxTWPihBfvJKk';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'Hdt3gZLafkkuJBlKbaLdPEd3neeRqDmHlH2j9HzNHWEB';

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
  const users = readUsers().map(u => ({ id: u.id, name: u.name, avatar: u.avatar || '👤', email: u.email }));
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

// --- LiveKit token endpoint ---
// Issues a token for a given LiveKit room. If the room name encodes a proximity pair,
// we validate that the requester is one of the pair and that both are nearby in the office.
app.post('/api/livekit/token', async (req, res) => {
  if (!LivekitServerSdk) {
    return res.status(500).json({ error: 'LiveKit server SDK not installed' });
  }
  const payload = verifyAuthHeader(req);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });

  const { room, identity, name } = req.body || {};
  if (!room) return res.status(400).json({ error: 'room is required' });

  // Optional proximity validation for pair rooms
  // Expected format: `${officeRoom}__pair__${socketIdA}__${socketIdB}`
  try {
    const parts = String(room).split('__pair__');
    if (parts.length === 2) {
      const officeRoom = parts[0];
      const [sidA, sidB] = parts[1].split('__');
      if (!sidA || !sidB) {
        return res.status(400).json({ error: 'invalid pair room format' });
      }

      // Find requester socket(s)
      const requesterSocketIds = Array.from(connectedUsers.entries())
        .filter(([sid, u]) => u.userId === payload.userId)
        .map(([sid]) => sid);

      if (!requesterSocketIds.includes(sidA) && !requesterSocketIds.includes(sidB)) {
        return res.status(403).json({ error: 'requester not a member of pair' });
      }

      const a = connectedUsers.get(sidA);
      const b = connectedUsers.get(sidB);
      if (!a || !b) return res.status(404).json({ error: 'pair participant not online' });
      if (a.room !== officeRoom || b.room !== officeRoom) {
        return res.status(403).json({ error: 'participants not in same office room' });
      }
      // Euclidean distance in grid tiles
      const dx = (a.position?.x || 0) - (b.position?.x || 0);
      const dy = (a.position?.y || 0) - (b.position?.y || 0);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const RADIUS = 3; // tiles
      if (distance > RADIUS) {
        return res.status(403).json({ error: 'participants not within proximity radius' });
      }
    }
  } catch (err) {
    return res.status(400).json({ error: 'invalid room name' });
  }

  try {
    if (!LivekitServerSdk.AccessToken) {
      console.error('LiveKit SDK missing AccessToken export');
      return res.status(500).json({ error: 'livekit_sdk_incomplete' });
    }
    const at = new LivekitServerSdk.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: identity || String(payload.userId),
      name: name || payload.name || 'User',
    });
    // Add grant using plain object to support all SDK versions
    at.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    const token = await at.toJwt();
    return res.json({ token, url: LIVEKIT_URL });
  } catch (e) {
    console.error('Failed to issue LiveKit token:', e?.message || e);
    return res.status(500).json({ error: 'failed_to_issue_token', detail: String(e?.message || e) });
  }
});

// Store connected users
const connectedUsers = new Map();
// Track active screen sharers by socket id -> { room, startedAt }
const activeScreenSharers = new Map();
// Track active audio speakers by socket id -> { room, startedAt }
const activeAudioSpeakers = new Map();
// Track active video broadcasters by socket id -> { room, startedAt }
const activeVideoBroadcasters = new Map();
// Track watchers per sharer: sharerSocketId -> Set(viewerSocketId)
const watchersBySharer = new Map();

function emitWatchers(io, sharerId) {
  try {
    const info = activeScreenSharers.get(sharerId);
    if (!info) return;
    const room = info.room;
    const set = watchersBySharer.get(sharerId) || new Set();
    const watchers = Array.from(set)
      .map((vid) => connectedUsers.get(vid))
      .filter(Boolean)
      .map((u) => ({ id: u.id, name: u.name, avatar: u.avatar }));
    io.to(room).emit('screenshare-watchers', { sharerId, watchers });
  } catch {}
}

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
      room: userData.room,
      presence: userData.presence || 'available'
    });
    
    // Broadcast to all users in the same room
    socket.join(userData.room);
    io.to(userData.room).emit('user-joined', {
      id: socket.id,
      userId: socket.data.userId,
      name,
      avatar,
      position: userData.position,
      room: userData.room,
      presence: userData.presence || 'available'
    });
    
    // Send current users in the room to the new user
    const roomUsers = Array.from(connectedUsers.values()).filter(user => user.room === userData.room);
    socket.emit('room-users', roomUsers);

    // Also send which users are currently sharing screens in this room
    const roomSharers = Array.from(activeScreenSharers.entries())
      .filter(([sid, info]) => info.room === userData.room)
      .map(([sid]) => sid);
    socket.emit('screenshare-active', { sharerIds: roomSharers });

    // Also send which users currently have mic on in this room
    const roomSpeakers = Array.from(activeAudioSpeakers.entries())
      .filter(([sid, info]) => info.room === userData.room)
      .map(([sid]) => sid);
    socket.emit('audio-active', { speakerIds: roomSpeakers });

    // Also send which users currently broadcasting camera in this room
    const roomVideo = Array.from(activeVideoBroadcasters.entries())
      .filter(([sid, info]) => info.room === userData.room)
      .map(([sid]) => sid);
    socket.emit('video-active', { broadcasterIds: roomVideo });
  });

  // Handle user movement
  socket.on('user-move', (data) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      const oldRoom = user.room;
      const oldPresence = user.presence || 'available';
      user.position = data.position;
      user.room = data.room;
      if (data.presence) user.presence = data.presence;

      // If room changed, move socket between rooms and notify both rooms
      if (oldRoom !== data.room) {
        if (oldRoom) {
          socket.leave(oldRoom);
          io.to(oldRoom).emit('user-left', socket.id);
        }
        socket.join(data.room);
        io.to(data.room).emit('user-joined', {
          id: socket.id,
          userId: user.userId,
          name: user.name,
          avatar: user.avatar,
          position: data.position,
          room: data.room,
          presence: user.presence || 'available'
        });
        // Send current users in the new room to the switching user
        const roomUsers = Array.from(connectedUsers.values()).filter(u => u.room === data.room && u.id !== socket.id);
        socket.emit('room-users', roomUsers);

        // If this user is currently sharing, update their room and notify both rooms
        if (activeScreenSharers.has(socket.id)) {
          // Notify old room that sharing stopped there
          if (oldRoom) {
            io.to(oldRoom).emit('screenshare-stopped', { sharerId: socket.id });
          }
          // Update their sharing room and notify new room that sharing is active
          activeScreenSharers.set(socket.id, { room: data.room, startedAt: Date.now() });
          io.to(data.room).emit('screenshare-started', { sharerId: socket.id, name: user.name, avatar: user.avatar });
          // Reset watchers in new room
          watchersBySharer.set(socket.id, new Set());
          emitWatchers(io, socket.id);
        }

        // If this user currently has mic on, update their room and notify both rooms
        if (activeAudioSpeakers.has(socket.id)) {
          // Notify old room that audio stopped there
          if (oldRoom) {
            io.to(oldRoom).emit('audio-stopped', { speakerId: socket.id });
          }
          // Update their audio room and notify new room that audio is active
          activeAudioSpeakers.set(socket.id, { room: data.room, startedAt: Date.now() });
          io.to(data.room).emit('audio-started', { speakerId: socket.id, name: user.name, avatar: user.avatar });
        }

        // If this user currently broadcasting camera, update their room and notify both rooms
        if (activeVideoBroadcasters.has(socket.id)) {
          if (oldRoom) {
            io.to(oldRoom).emit('video-stopped', { broadcasterId: socket.id });
          }
          activeVideoBroadcasters.set(socket.id, { room: data.room, startedAt: Date.now() });
          io.to(data.room).emit('video-started', { broadcasterId: socket.id, name: user.name, avatar: user.avatar });
        }
      } else {
        // Broadcast movement to current room
        io.to(data.room).emit('user-moved', {
          id: socket.id,
          position: data.position,
          room: data.room,
          presence: user.presence || 'available'
        });
        // If presence changed, also broadcast a dedicated event
        if ((user.presence || 'available') !== oldPresence) {
          io.to(data.room).emit('presence-changed', { id: socket.id, presence: user.presence || 'available' });
        }
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

  // --- Screen share signaling (WebRTC over Socket.IO) ---
  socket.on('start-screenshare', () => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;
    activeScreenSharers.set(socket.id, { room: user.room, startedAt: Date.now() });
    io.to(user.room).emit('screenshare-started', { sharerId: socket.id, name: user.name, avatar: user.avatar });
    if (!watchersBySharer.has(socket.id)) watchersBySharer.set(socket.id, new Set());
    emitWatchers(io, socket.id);
  });

  socket.on('stop-screenshare', () => {
    const info = activeScreenSharers.get(socket.id);
    if (!info) return;
    activeScreenSharers.delete(socket.id);
    watchersBySharer.delete(socket.id);
    io.to(info.room).emit('screenshare-stopped', { sharerId: socket.id });
  });

  // Viewer requests to subscribe to sharer's stream
  socket.on('screenshare-subscribe', ({ sharerId }) => {
    if (!sharerId) return;
    const sharer = connectedUsers.get(sharerId);
    const viewer = connectedUsers.get(socket.id);
    if (!sharer || !viewer) return;
    // Only relay if in same office room and within proximity radius
    if (sharer.room !== viewer.room) return;
    const dx = (sharer.position?.x || 0) - (viewer.position?.x || 0);
    const dy = (sharer.position?.y || 0) - (viewer.position?.y || 0);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const RADIUS = 3;
    if (distance > RADIUS) return;
    io.to(sharerId).emit('screenshare-subscribe', { from: socket.id });
  });

  // Viewer unsubscribes (moved away)
  socket.on('screenshare-unsubscribe', ({ sharerId }) => {
    if (!sharerId) return;
    io.to(sharerId).emit('screenshare-unsubscribe', { from: socket.id });
    const set = watchersBySharer.get(sharerId);
    if (set && set.has(socket.id)) {
      set.delete(socket.id);
      emitWatchers(io, sharerId);
    }
  });

  // Generic WebRTC signaling relay
  socket.on('webrtc-offer', ({ to, sdp }) => {
    if (!to || !sdp) return;
    io.to(to).emit('webrtc-offer', { from: socket.id, sdp });
  });

  socket.on('webrtc-answer', ({ to, sdp }) => {
    if (!to || !sdp) return;
    io.to(to).emit('webrtc-answer', { from: socket.id, sdp });
  });

  socket.on('webrtc-ice-candidate', ({ to, candidate }) => {
    if (!to || !candidate) return;
    io.to(to).emit('webrtc-ice-candidate', { from: socket.id, candidate });
  });

  // --- Proximity voice (mic) signaling (WebRTC over Socket.IO) ---
  socket.on('start-audio', () => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;
    activeAudioSpeakers.set(socket.id, { room: user.room, startedAt: Date.now() });
    io.to(user.room).emit('audio-started', { speakerId: socket.id, name: user.name, avatar: user.avatar });
  });

  socket.on('stop-audio', () => {
    const info = activeAudioSpeakers.get(socket.id);
    if (!info) return;
    activeAudioSpeakers.delete(socket.id);
    io.to(info.room).emit('audio-stopped', { speakerId: socket.id });
  });

  // Listener requests to subscribe to speaker's mic
  socket.on('audio-subscribe', ({ speakerId }) => {
    if (!speakerId) return;
    const speaker = connectedUsers.get(speakerId);
    const listener = connectedUsers.get(socket.id);
    if (!speaker || !listener) return;
    // Only relay if in same office room and within proximity radius
    if (speaker.room !== listener.room) return;
    const dx = (speaker.position?.x || 0) - (listener.position?.x || 0);
    const dy = (speaker.position?.y || 0) - (listener.position?.y || 0);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const RADIUS = 3;
    if (distance > RADIUS) return;
    io.to(speakerId).emit('audio-subscribe', { from: socket.id });
  });

  // Listener unsubscribes (moved away)
  socket.on('audio-unsubscribe', ({ speakerId }) => {
    if (!speakerId) return;
    io.to(speakerId).emit('audio-unsubscribe', { from: socket.id });
  });

  // Relay WebRTC for audio
  socket.on('audio-webrtc-offer', ({ to, sdp }) => {
    if (!to || !sdp) return;
    io.to(to).emit('audio-webrtc-offer', { from: socket.id, sdp });
  });
  socket.on('audio-webrtc-answer', ({ to, sdp }) => {
    if (!to || !sdp) return;
    io.to(to).emit('audio-webrtc-answer', { from: socket.id, sdp });
  });
  socket.on('audio-ice-candidate', ({ to, candidate }) => {
    if (!to || !candidate) return;
    io.to(to).emit('audio-ice-candidate', { from: socket.id, candidate });
  });

  // --- Proximity camera video signaling (WebRTC over Socket.IO) ---
  socket.on('start-video', () => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;
    activeVideoBroadcasters.set(socket.id, { room: user.room, startedAt: Date.now() });
    io.to(user.room).emit('video-started', { broadcasterId: socket.id, name: user.name, avatar: user.avatar });
  });

  socket.on('stop-video', () => {
    const info = activeVideoBroadcasters.get(socket.id);
    if (!info) return;
    activeVideoBroadcasters.delete(socket.id);
    io.to(info.room).emit('video-stopped', { broadcasterId: socket.id });
  });

  socket.on('video-subscribe', ({ broadcasterId }) => {
    if (!broadcasterId) return;
    const broadcaster = connectedUsers.get(broadcasterId);
    const viewer = connectedUsers.get(socket.id);
    if (!broadcaster || !viewer) return;
    if (broadcaster.room !== viewer.room) return;
    const dx = (broadcaster.position?.x || 0) - (viewer.position?.x || 0);
    const dy = (broadcaster.position?.y || 0) - (viewer.position?.y || 0);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const RADIUS = 3;
    if (distance > RADIUS) return;
    io.to(broadcasterId).emit('video-subscribe', { from: socket.id });
  });

  socket.on('video-unsubscribe', ({ broadcasterId }) => {
    if (!broadcasterId) return;
    io.to(broadcasterId).emit('video-unsubscribe', { from: socket.id });
  });

  socket.on('video-webrtc-offer', ({ to, sdp }) => {
    if (!to || !sdp) return;
    io.to(to).emit('video-webrtc-offer', { from: socket.id, sdp });
  });
  socket.on('video-webrtc-answer', ({ to, sdp }) => {
    if (!to || !sdp) return;
    io.to(to).emit('video-webrtc-answer', { from: socket.id, sdp });
  });
  socket.on('video-ice-candidate', ({ to, candidate }) => {
    if (!to || !candidate) return;
    io.to(to).emit('video-ice-candidate', { from: socket.id, candidate });
  });

  // Wave feature: simple real-time notification
  socket.on('wave-send', ({ to }) => {
    if (!to) return;
    const sender = connectedUsers.get(socket.id);
    const recipient = connectedUsers.get(to);
    if (!sender || !recipient) return;
    if ((recipient.presence || 'available') === 'dnd') return; // do not disturb: block waves
    // same room proximity optional: uncomment to restrict
    // if (sender.room !== recipient.room) return;
    io.to(to).emit('wave-received', { from: { id: socket.id, name: sender.name, avatar: sender.avatar } });
  });

  // Viewer declares they started or stopped watching a sharer
  socket.on('viewer-started-watching', ({ sharerId }) => {
    if (!sharerId) return;
    const sharer = connectedUsers.get(sharerId);
    const viewer = connectedUsers.get(socket.id);
    if (!sharer || !viewer) return;
    if (!activeScreenSharers.has(sharerId)) return;
    if (sharer.room !== viewer.room) return;
    const dx = (sharer.position?.x || 0) - (viewer.position?.x || 0);
    const dy = (sharer.position?.y || 0) - (viewer.position?.y || 0);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const RADIUS = 3;
    if (distance > RADIUS) return;
    let set = watchersBySharer.get(sharerId);
    if (!set) { set = new Set(); watchersBySharer.set(sharerId, set); }
    set.add(socket.id);
    emitWatchers(io, sharerId);
  });

  socket.on('viewer-stopped-watching', ({ sharerId }) => {
    if (!sharerId) return;
    const set = watchersBySharer.get(sharerId);
    if (!set) return;
    if (set.delete(socket.id)) emitWatchers(io, sharerId);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      io.to(user.room).emit('user-left', socket.id);
      connectedUsers.delete(socket.id);
    }
    // optional: emit presence offline to room
    // if (user) io.to(user.room).emit('presence-changed', { id: socket.id, presence: 'offline' });
    // If they were sharing, notify viewers
    if (activeScreenSharers.has(socket.id)) {
      const info = activeScreenSharers.get(socket.id);
      activeScreenSharers.delete(socket.id);
      io.to(info.room).emit('screenshare-stopped', { sharerId: socket.id });
      watchersBySharer.delete(socket.id);
    }
    if (activeAudioSpeakers.has(socket.id)) {
      const infoA = activeAudioSpeakers.get(socket.id);
      activeAudioSpeakers.delete(socket.id);
      io.to(infoA.room).emit('audio-stopped', { speakerId: socket.id });
    }
    if (activeVideoBroadcasters.has(socket.id)) {
      const infoV = activeVideoBroadcasters.get(socket.id);
      activeVideoBroadcasters.delete(socket.id);
      io.to(infoV.room).emit('video-stopped', { broadcasterId: socket.id });
    }
    // If they were a watcher, remove from all sets
    try {
      for (const [sid, set] of watchersBySharer.entries()) {
        if (set.delete(socket.id)) emitWatchers(io, sid);
      }
    } catch {}
    console.log('User disconnected:', socket.id);
  });
});

// SPA fallback (must be after API routes and before server.listen)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
