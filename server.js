const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Store connected users
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user joining
  socket.on('join-office', (userData) => {
    connectedUsers.set(socket.id, {
      id: socket.id,
      name: userData.name,
      avatar: userData.avatar,
      position: userData.position,
      room: userData.room
    });
    
    // Broadcast to all users in the same room
    socket.join(userData.room);
    io.to(userData.room).emit('user-joined', {
      id: socket.id,
      name: userData.name,
      avatar: userData.avatar,
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
