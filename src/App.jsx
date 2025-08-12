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
  const [roomMessages, setRoomMessages] = useState([]);
  const [dmMessages, setDmMessages] = useState({}); // { [peerUserId]: Message[] }
  const [currentRoom, setCurrentRoom] = useState('main-office');
  const [isConnected, setIsConnected] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [account, setAccount] = useState(null);
  const [directory, setDirectory] = useState([]); // all registered users
  const [dmPeerId, setDmPeerId] = useState(null);
  const [unreadByUserId, setUnreadByUserId] = useState({});
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Fetch account profile when token exists (name, avatar)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setAccount(null);
      return;
    }
    fetch('/api/auth/me', {
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

  // Load user directory
  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(({ users }) => setDirectory(users || []))
      .catch(() => setDirectory([]));
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

    return () => {
      newSocket.close();
    };
  }, []);

  // Socket: presence and movement handlers
  useEffect(() => {
    if (!socket) return;
    const onJoined = (newUser) => setUsers(prev => [...prev.filter(u => u.id !== newUser.id), newUser]);
    const onLeft = (userId) => setUsers(prev => prev.filter(u => u.id !== userId));
    const onMoved = (userData) => setUsers(prev => prev.map(u => u.id === userData.id ? { ...u, position: userData.position, room: userData.room } : u));
    const onRoomUsers = (roomUsers) => setUsers(roomUsers.filter(u => u.id !== socket.id));

    socket.on('user-joined', onJoined);
    socket.on('user-left', onLeft);
    socket.on('user-moved', onMoved);
    socket.on('room-users', onRoomUsers);

    return () => {
      socket.off('user-joined', onJoined);
      socket.off('user-left', onLeft);
      socket.off('user-moved', onMoved);
      socket.off('room-users', onRoomUsers);
    };
  }, [socket]);

  // Room messages listener disabled in DM-first UI

  // Socket: direct messages
  useEffect(() => {
    if (!socket) return;
    const onDirect = (message) => {
      setDmMessages((prev) => {
        const myId = account?.id;
        const otherId = message.fromUserId === myId ? message.toUserId : message.fromUserId;
        const thread = prev[otherId] || [];
        return { ...prev, [otherId]: [...thread, message] };
      });
      const myId = account?.id;
      const otherId = message.fromUserId === myId ? message.toUserId : message.fromUserId;
      const isActiveThread = otherId === dmPeerId;
      if (!isActiveThread || document.visibilityState !== 'visible') {
        setUnreadByUserId((prev) => ({ ...prev, [otherId]: (prev[otherId] || 0) + 1 }));
      }
    };
    socket.on('new-direct-message', onDirect);
    return () => {
      socket.off('new-direct-message', onDirect);
    };
  }, [socket, account?.id, dmPeerId]);

  // Auto-select first user from directory if none selected
  useEffect(() => {
    if (!dmPeerId && directory.length > 0) {
      const first = directory.find(u => u.id !== account?.id) || directory[0];
      if (first?.id) {
        setDmPeerId(first.id);
        loadDmHistory(first.id);
      }
    }
  }, [directory, account?.id]);

  // Room history prefetch disabled in DM-first UI

  // Close user menu on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (!isUserMenuOpen) return;
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isUserMenuOpen]);

  const loadDmHistory = (peerUserId) => {
    const token = localStorage.getItem('token');
    if (!token || !peerUserId) return;
    fetch(`/api/chat/dm/${encodeURIComponent(peerUserId)}?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(({ messages }) => setDmMessages(prev => ({ ...prev, [peerUserId]: messages || [] })))
      .catch(() => setDmMessages(prev => ({ ...prev, [peerUserId]: [] })));
  };

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
      if (dmPeerId) {
        socket.emit('send-direct-message', { toUserId: dmPeerId, message });
      }
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
      <div ref={userMenuRef} style={{ position: 'fixed', top: 12, right: 12, zIndex: 12000 }}>
        <button
          className="user-menu-button"
          aria-label="User menu"
          onClick={() => setIsUserMenuOpen(o => !o)}
          title={account?.name || 'Account'}
        >
          <span style={{ fontSize: 18 }}>{account?.avatar || localStorage.getItem('user_avatar') || '👤'}</span>
        </button>
        {isUserMenuOpen && (
          <div className="user-menu">
            <div className="user-menu-header">
              <div className="user-menu-avatar">{account?.avatar || '👤'}</div>
              <div className="user-menu-name">{account?.name || 'User'}</div>
              {account?.email && (<div className="user-menu-email">{account.email}</div>)}
            </div>
            <div className="user-menu-actions">
              <button className="user-menu-item" onClick={() => setIsUserMenuOpen(false)}>Profile</button>
              <button
                className="user-menu-item danger"
                onClick={() => {
                  try { socket?.disconnect(); } catch {}
                  localStorage.removeItem('token');
                  localStorage.removeItem('user_name');
                  localStorage.removeItem('user_avatar');
                  window.location.reload();
                }}
              >Logout</button>
            </div>
          </div>
        )}
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

      {user && isChatOpen && (
        <ChatPanel 
          messages={dmMessages[dmPeerId] || []}
          onSendMessage={handleSendMessage}
          currentUser={user}
          account={account}
          users={directory.filter(u => u.id !== account?.id)}
          dmThreads={dmMessages}
          unreadByUserId={unreadByUserId}
          dmPeerId={dmPeerId}
          onSelectPeer={(peerId) => {
            setDmPeerId(peerId);
            loadDmHistory(peerId);
            setUnreadByUserId(prev => ({ ...prev, [peerId]: 0 }));
          }}
          onClose={() => setIsChatOpen(false)}
        />
      )}

      {user && !isChatOpen && (
        <button
          aria-label="Open chat"
          onClick={() => setIsChatOpen(true)}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: 'none',
            background: '#F59E0B',
            color: '#111111',
            fontSize: 22,
            cursor: 'pointer',
            zIndex: 11000,
            boxShadow: '0 10px 28px rgba(245,158,11,0.35)'
          }}
        >💬</button>
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
