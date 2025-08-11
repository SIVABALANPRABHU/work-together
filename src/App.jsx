import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
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

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
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
      const user = {
        ...userData,
        id: socket.id,
        position: { x: 5, y: 5 },
        room: currentRoom
      };
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
      const newPosition = { x: 5, y: 5 };
      const updatedUser = { ...user, position: newPosition, room: newRoom };
      setUser(updatedUser);
      socket.emit('user-move', {
        position: newPosition,
        room: newRoom
      });
    }
  };

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
      <OfficeGrid 
        layout={officeLayout} 
        objects={officeObjects}
        currentRoom={currentRoom}
      />
      
      {user && (
        <Character 
          user={user}
          onMove={handleMove}
          isCurrentUser={true}
        />
      )}
      
      {users.map(user => (
        <Character 
          key={user.id}
          user={user}
          onMove={() => {}}
          isCurrentUser={false}
        />
      ))}

      {showControls && (
        <Controls 
          onJoinOffice={handleJoinOffice}
          onRoomChange={handleRoomChange}
          currentRoom={currentRoom}
          user={user}
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
