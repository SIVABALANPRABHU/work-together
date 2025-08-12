import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Auth from './components/Auth';
import OfficeGrid from './components/OfficeGrid';
import Character from './components/Character';
import Controls from './components/Controls';
import ChatPanel from './components/ChatPanel';
import RoomInfo from './components/RoomInfo';
import { officeLayout, officeObjects } from './data/officeData';

function App() {
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('main-office');
  const [isConnected, setIsConnected] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [account, setAccount] = useState(null);

  // Fetch account profile when token exists (name, avatar)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setAccount(null);
      return;
    }
    fetch('http://localhost:5000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('unauthorized');
        return res.json();
      })
      .then(({ user }) => {
        setAccount(user);
        if (user?.name) localStorage.setItem('user_name', user.name);
        if (user?.avatar) localStorage.setItem('user_avatar', user.avatar);
      })
      .catch(() => {
        // token invalid; force logout
        localStorage.removeItem('token');
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_avatar');
        setAccount(null);
      });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setSocket(null);
      return;
    }
    const newSocket = io('http://localhost:5000', {
      auth: { token }
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    newSocket.on('user-joined', (newUser) => {
      setUsers(prev => [...prev.filter(u => u.id !== newUser.id), newUser]);
    });

    newSocket.on('user-left', (userId) => {
      setUsers(prev => prev.filter(u => u.id !== userId));
    });

    newSocket.on('user-moved', (userData) => {
      setUsers(prev => prev.map(u => 
        u.id === userData.id 
          ? { ...u, position: userData.position, room: userData.room }
          : u
      ));
    });

    newSocket.on('room-users', (roomUsers) => {
      setUsers(roomUsers.filter(u => u.id !== newSocket.id));
    });

    newSocket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleJoinOffice = (userData) => {
    if (socket) {
      const chosenAvatar = userData.avatar || account?.avatar || localStorage.getItem('user_avatar') || '👨';
      const displayName = userData.name || account?.name || localStorage.getItem('user_name') || 'Guest';
      const user = {
        ...userData,
        name: displayName,
        avatar: chosenAvatar,
        id: socket.id,
        position: { x: 15, y: 12 }, // Adjusted for 30x25 grid
        room: currentRoom
      };
      // persist avatar for future sessions
      localStorage.setItem('user_avatar', chosenAvatar);
      setUser(user);
      socket.emit('join-office', user);
    }
  };

  const handleMove = (newPosition) => {
    if (socket && user) {
      const updatedUser = { ...user, position: newPosition };
      setUser(updatedUser);
      socket.emit('user-move', {
        position: newPosition,
        room: currentRoom
      });
    }
  };

  const handleSendMessage = (message) => {
    if (socket) {
      socket.emit('send-message', { message });
    }
  };

  const handleRoomChange = (newRoom) => {
    setCurrentRoom(newRoom);
    if (user && socket) {
      const newPosition = { x: 15, y: 12 }; // Adjusted for 30x25 grid
      const updatedUser = { ...user, position: newPosition, room: newRoom };
      setUser(updatedUser);
      socket.emit('user-move', {
        position: newPosition,
        room: newRoom
      });
    }
  };

  if (!localStorage.getItem('token')) {
    return (
      <div className="office-container">
        <Auth onAuthSuccess={() => setIsConnected(false)} />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="office-container">
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <h1 style={{ color: '#64ffda', marginBottom: '20px' }}>Virtual Office</h1>
          <p style={{ color: '#b0b0b0' }}>Connecting to server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="office-container">
      <div style={{ position: 'fixed', top: 12, right: 12, color: '#b0b0b0', display: 'flex', alignItems: 'center', gap: 8, zIndex: 10000 }}>
        <div style={{ background: '#1e1e3f', border: '1px solid #2d2d5f', borderRadius: 16, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{account?.avatar || localStorage.getItem('user_avatar') || '👤'}</span>
          <span style={{ fontWeight: 600, color: '#fff' }}>{account?.name || localStorage.getItem('user_name') || 'User'}</span>
        </div>
        <button
          className="btn"
          onClick={() => {
            try { socket?.disconnect(); } catch {}
            localStorage.removeItem('token');
            localStorage.removeItem('user_name');
            localStorage.removeItem('user_avatar');
            window.location.reload();
          }}
        >
          Logout
        </button>
      </div>
      <OfficeGrid currentRoom={currentRoom}>
        {/* Characters are now rendered inside the zoomable OfficeGrid */}
        {user && (
          <Character 
            user={user}
            onMove={handleMove}
            isCurrentUser={true}
          />
        )}
        
        {users
          .filter(u => u.room === currentRoom)
          .map(user => (
            <Character 
              key={user.id}
              user={user}
              onMove={() => {}}
              isCurrentUser={false}
            />
          ))}
      </OfficeGrid>
      
      {showControls && (
        <Controls 
          onJoinOffice={handleJoinOffice}
          onRoomChange={handleRoomChange}
          currentRoom={currentRoom}
          user={user}
          account={account}
        />
      )}

      <RoomInfo 
        currentRoom={currentRoom}
        userCount={users.length + (user ? 1 : 0)}
        isConnected={isConnected}
      />

      {user && (
        <ChatPanel 
          messages={messages}
          onSendMessage={handleSendMessage}
          currentUser={user}
        />
      )}

      <button 
        onClick={() => setShowControls(!showControls)}
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          zIndex: 100,
          background: '#64ffda',
          color: '#0f0f23',
          border: 'none',
          padding: '10px',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          cursor: 'pointer',
          fontSize: '20px'
        }}
      >
        {showControls ? '×' : '⚙'}
      </button>
    </div>
  );
}

export default App;
