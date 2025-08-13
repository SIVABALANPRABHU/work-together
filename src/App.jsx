import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Room } from 'livekit-client';
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

  // LiveKit local state
  const [lkRoom, setLkRoom] = useState(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [nearbyPeerSocketId, setNearbyPeerSocketId] = useState(null);
  const [selectedNearbyUserId, setSelectedNearbyUserId] = useState(null);
  const PROXIMITY_RADIUS = 3; // tiles
  const remoteScreensRef = useRef(null);
  const removeScreenTileByParticipantSid = (participantSid) => {
    try {
      const container = remoteScreensRef.current;
      if (!container) return;
      const node = container.querySelector(`.screen-tile[data-participant-sid="${participantSid}"]`);
      if (node) container.removeChild(node);
    } catch {}
  };

  function clearRemoteScreens() {
    try {
      const container = remoteScreensRef.current;
      if (!container) return;
      // Detach any attached elements by removing them
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    } catch {}
  }

  // Nearby users within radius (sorted by distance) and nearest peer
  const { nearbyUsers, nearestPeer } = useMemo(() => {
    if (!user) return { nearbyUsers: [], nearestPeer: null };
    const sameRoom = users.filter(u => u.room === user.room);
    let minD = Infinity;
    let nearest = null;
    const within = [];
    for (const u of sameRoom) {
      const dx = (u.position?.x || 0) - (user.position?.x || 0);
      const dy = (u.position?.y || 0) - (user.position?.y || 0);
      const d = Math.hypot(dx, dy);
      if (d <= PROXIMITY_RADIUS) within.push({ ...u, _distance: d });
      if (d < minD) { minD = d; nearest = u; }
    }
    within.sort((a, b) => a._distance - b._distance);
    return {
      nearbyUsers: within,
      nearestPeer: minD <= PROXIMITY_RADIUS ? nearest : null,
    };
  }, [users, user]);

  // Target peer (selected if still nearby, else nearest)
  const targetPeerSocketId = useMemo(() => {
    if (!selectedNearbyUserId) return nearestPeer?.id || null;
    return nearbyUsers.some(u => u.id === selectedNearbyUserId) ? selectedNearbyUserId : (nearestPeer?.id || null);
  }, [selectedNearbyUserId, nearbyUsers, nearestPeer]);

  useEffect(() => {
    setNearbyPeerSocketId(nearestPeer?.id || null);
    if (!nearestPeer && lkRoom) {
      // Leave LiveKit if we moved away
      try { lkRoom.disconnect(); } catch {}
      setLkRoom(null);
      setIsSharingScreen(false);
    }
  }, [nearestPeer]);

  // Auto-join LiveKit when in proximity so peers can see each other's screen share without manual action
  useEffect(() => {
    if (!user) return;
    if (!targetPeerSocketId) return;
    (async () => {
      try { await ensureLiveKitJoined(); } catch {}
    })();
  }, [user?.room, targetPeerSocketId]);

  async function getLiveKitToken(roomName) {
    const token = localStorage.getItem('token');
    const me = account;
    const res = await fetch('/api/livekit/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ room: roomName, identity: me?.id, name: me?.name })
    });
    if (!res.ok) throw new Error('failed token');
    return res.json(); // { token, url }
  }

  async function ensureLiveKitJoined() {
    if (!user || !targetPeerSocketId) return null;
    const pairRoom = `${user.room}__pair__${[socket.id, targetPeerSocketId].sort().join('__')}`;
    if (lkRoom && lkRoom.name === pairRoom) return lkRoom;
    try {
      if (lkRoom) {
        try { await lkRoom.disconnect(); } catch {}
        setLkRoom(null);
      }
      const { token, url } = await getLiveKitToken(pairRoom);
      const room = new Room({ adaptiveStream: true });
      await room.connect(url, token, { autoSubscribe: true });
      setLkRoom(room);
      // Basic event hooks
      room.on('disconnected', () => {
        setLkRoom(null);
        setIsSharingScreen(false);
        clearRemoteScreens();
      });
      room.on('localTrackPublished', (publication, participant) => {
        try {
          if (publication?.source === 'screen_share' && publication?.track?.kind === 'video') {
            const videoEl = document.createElement('video');
            videoEl.autoplay = true;
            videoEl.muted = true;
            videoEl.playsInline = true;
            const tile = document.createElement('div');
            tile.className = 'screen-tile';
            tile.dataset.participantSid = participant.sid;
            const label = document.createElement('div');
            label.className = 'screen-label';
            label.textContent = 'You';
            tile.appendChild(videoEl);
            tile.appendChild(label);
            publication.track.attach(videoEl);
            remoteScreensRef.current?.appendChild(tile);
          }
        } catch (e) {
          console.error('attach local screen track failed', e);
        }
      });
      room.on('localTrackUnpublished', (publication, participant) => {
        try {
          if (publication?.source === 'screen_share') {
            removeScreenTileByParticipantSid(participant.sid);
          }
        } catch {}
      });
      room.on('trackSubscribed', (track, publication, participant) => {
        try {
          if (publication?.source === 'screen_share' && track.kind === 'video') {
            const videoEl = document.createElement('video');
            videoEl.autoplay = true;
            videoEl.muted = true;
            videoEl.playsInline = true;
            const tile = document.createElement('div');
            tile.className = 'screen-tile';
            tile.dataset.participantSid = participant.sid;
            const label = document.createElement('div');
            label.className = 'screen-label';
            label.textContent = participant?.name || participant?.identity || 'Screen';
            tile.appendChild(videoEl);
            tile.appendChild(label);
            track.attach(videoEl);
            remoteScreensRef.current?.appendChild(tile);
          }
        } catch (e) {
          console.error('attach screen track failed', e);
        }
      });
      room.on('trackUnsubscribed', (track, publication, participant) => {
        try {
          if (publication?.source === 'screen_share' && track.kind === 'video') {
            try {
              const container = remoteScreensRef.current;
              if (!container) return;
              const tile = container.querySelector(`.screen-tile[data-participant-sid="${participant.sid}"]`);
              if (!tile) return;
              const videoEl = tile.querySelector('video');
              if (videoEl) {
                try { track.detach(videoEl); } catch {}
              }
              container.removeChild(tile);
            } catch {}
          }
        } catch {}
      });
      room.on('participantDisconnected', (participant) => {
        try {
          removeScreenTileByParticipantSid(participant.sid);
        } catch {}
      });
      return room;
    } catch (e) {
      console.error('LiveKit join failed', e);
      return null;
    }
  }

  async function toggleScreenShare() {
    if (!targetPeerSocketId) return;
    const room = await ensureLiveKitJoined();
    if (!room) return;

    const existing = room.localParticipant.getTrackPublications().find(pub => pub.source === 'screen_share');
    if (existing && isSharingScreen) {
      await room.localParticipant.setScreenShareEnabled(false);
      setIsSharingScreen(false);
      try { removeScreenTileByParticipantSid(room.localParticipant.sid); } catch {}
      return;
    }
    try {
      await room.localParticipant.setScreenShareEnabled(true);
      setIsSharingScreen(true);
    } catch (e) {
      console.error('Screen share failed', e);
      setIsSharingScreen(false);
    }
  }

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
            showRadius={true}
            radiusTiles={PROXIMITY_RADIUS}
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
      
      <Controls 
        onJoinOffice={handleJoinOffice}
        onRoomChange={handleRoomChange}
        currentRoom={currentRoom}
        user={user}
        account={account}
        collapsed={!showControls}
        onToggle={() => setShowControls((v) => !v)}
      />

      <RoomInfo 
        currentRoom={currentRoom}
        userCount={users.length + (user ? 1 : 0)}
        isConnected={isConnected}
      />

      {/* Nearby users top bar (Gather-like) */}
      {user && nearbyUsers.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 10,
            padding: 8,
            borderRadius: 12,
            background: 'rgba(17,17,17,0.6)',
            backdropFilter: 'blur(6px)',
            zIndex: 12500,
            boxShadow: '0 10px 28px rgba(0,0,0,0.35)'
          }}
        >
          {nearbyUsers.map((u) => {
            const isSelected = targetPeerSocketId === u.id;
            return (
              <button
                key={u.id}
                onClick={() => setSelectedNearbyUserId(prev => (prev === u.id ? null : u.id))}
                title={u.name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 68,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: isSelected ? '2px solid #64FFDA' : '1px solid rgba(255,255,255,0.18)',
                  background: isSelected ? 'rgba(100,255,218,0.12)' : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: 18 }}>{u.avatar || '👤'}</span>
                <span
                  style={{
                    fontSize: 11,
                    marginTop: 4,
                    maxWidth: 100,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 600
                  }}
                >
                  {u.name}
                </span>
              </button>
            );
          })}
        </div>
      )}

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

      {user && (
        <div style={{ position: 'fixed', bottom: 20, left: 20, display: 'flex', gap: 8, zIndex: 11000 }}>
          <button
            aria-label="Toggle screen share"
            onClick={toggleScreenShare}
            disabled={!targetPeerSocketId}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: 'none',
              background: targetPeerSocketId ? '#64FFDA' : '#3a3a3a',
              color: '#111',
              cursor: targetPeerSocketId ? 'pointer' : 'not-allowed',
              boxShadow: '0 10px 28px rgba(100,255,218,0.25)'
            }}
            title={targetPeerSocketId ? 'Start/Stop screen share with nearby user' : 'Move closer to a user to enable screen share'}
          >{isSharingScreen ? 'Stop Share' : 'Share Screen'}</button>
        </div>
      )}

      {lkRoom && (
        <div
          ref={remoteScreensRef}
          style={{
            position: 'fixed',
            bottom: 90,
            left: 20,
            display: 'flex',
            gap: 10,
            padding: 6,
            borderRadius: 12,
            background: 'rgba(17,17,17,0.55)',
            backdropFilter: 'blur(6px)',
            zIndex: 11000,
            maxWidth: '80vw',
            overflowX: 'auto'
          }}
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

      
    </div>
  );
}

export default App;
