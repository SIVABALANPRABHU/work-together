import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  
  // Screen share and WebRTC state
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const localScreenStreamRef = useRef(null);
  const sharerPeerConnsRef = useRef(new Map()); // as sharer: viewerSocketId -> RTCPeerConnection
  const viewerPeerConnsRef = useRef(new Map()); // as viewer: sharerSocketId -> RTCPeerConnection
  const [activeSharerIds, setActiveSharerIds] = useState([]); // socket ids in my room currently sharing
  const [screenTiles, setScreenTiles] = useState({}); // { [sharerId]: { left, top, width, height, visible, title, ended } }
  const viewerStreamsRef = useRef(new Map()); // as viewer: sharerSocketId -> MediaStream
  const [fullScreenSharerId, setFullScreenSharerId] = useState(null);
  const [fsControlsVisible, setFsControlsVisible] = useState(true);
  const fsHideTimerRef = useRef(null);
  const [watchersBySharerId, setWatchersBySharerId] = useState({}); // { [sharerId]: [{id,name,avatar}] }
  const [fsViewersExpanded, setFsViewersExpanded] = useState(false);
  const [minimizedSharerIds, setMinimizedSharerIds] = useState([]);

  const addMinimizedSharer = (id) => setMinimizedSharerIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const removeMinimizedSharer = (id) => setMinimizedSharerIds((prev) => prev.filter(x => x !== id));
  const [toasts, setToasts] = useState([]);
  const addToast = (text, type = 'info', ttlMs = 2800) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => setToasts((prev) => prev.filter(t => t.id !== id)), ttlMs);
  };

  const PROXIMITY_RADIUS = 3; // tiles

  // Nearby users within radius (sorted by distance)
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

  // Determine which sharers are within proximity to view
  const eligibleSharerIds = useMemo(() => {
    if (!user) return [];
    const set = new Set();
    for (const sharerId of activeSharerIds) {
      const u = users.find(x => x.id === sharerId && x.room === user.room);
      if (!u) continue;
      const dx = (u.position?.x || 0) - (user.position?.x || 0);
      const dy = (u.position?.y || 0) - (user.position?.y || 0);
      const d = Math.hypot(dx, dy);
      if (d <= PROXIMITY_RADIUS) set.add(sharerId);
    }
    return Array.from(set);
  }, [activeSharerIds, users, user]);

  const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

  function ensureScreenTile(sharerId, title) {
    setScreenTiles(prev => {
      if (prev[sharerId]) return prev;
      // Default larger dock size and positioned near top center
      const width = 560;
      const height = 340;
      const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const left = Math.max(12, Math.round((viewportW - width) / 2));
      const top = 96;
      return { ...prev, [sharerId]: { left, top, width, height, visible: true, title: title || 'Screen', ended: false } };
    });
  }

  function updateScreenTile(sharerId, partial) {
    setScreenTiles(prev => ({ ...prev, [sharerId]: { ...(prev[sharerId] || {}), ...partial } }));
  }

  function removeScreenTile(sharerId) {
    setScreenTiles(prev => {
      const next = { ...prev };
      delete next[sharerId];
      return next;
    });
  }

  function dockScreenTileToTop(sharerId) {
    const width = 560;
    const height = 340;
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const left = Math.max(12, Math.round((viewportW - width) / 2));
    const top = 96; // below top bars
    ensureScreenTile(sharerId, (users.find(u => u.id === sharerId)?.name) || 'Screen');
    updateScreenTile(sharerId, { left, top, width, height, visible: true });
  }

  function dockScreenTileToAnchor(sharerId) {
    try {
      const el = document.getElementById(`nearby-card-${sharerId}`);
      const width = 560;
      const height = 340;
      if (el) {
        const rect = el.getBoundingClientRect();
        const left = Math.max(8, Math.round(rect.left + (rect.width / 2) - (width / 2)));
        const top = Math.max(8, Math.round(rect.top + (rect.height / 2) - (height / 2)));
        ensureScreenTile(sharerId, (users.find(u => u.id === sharerId)?.name) || 'Screen');
        updateScreenTile(sharerId, { left, top, width, height, visible: true });
        return;
      }
    } catch {}
    dockScreenTileToTop(sharerId);
  }

  async function toggleScreenShare() {
    if (isSharingScreen) {
      // Stop
      try {
        localScreenStreamRef.current?.getTracks()?.forEach(t => t.stop());
      } catch {}
      localScreenStreamRef.current = null;
      setIsSharingScreen(false);
      try { socket?.emit('stop-screenshare'); } catch {}
      // Close all viewer peer connections
      for (const [, pc] of sharerPeerConnsRef.current) {
        try { pc.close(); } catch {}
      }
      sharerPeerConnsRef.current.clear();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      localScreenStreamRef.current = stream;
      setIsSharingScreen(true);
      // Auto stop if user ends via browser UX
      const [track] = stream.getVideoTracks();
      if (track) {
        try {
          const senderParams = track.getSettings?.() || {};
          // Optional: tweak encoding on actual sender per peer later via setParameters
        } catch {}
        track.onended = () => {
          setIsSharingScreen(false);
          try { socket?.emit('stop-screenshare'); } catch {}
          for (const [, pc] of sharerPeerConnsRef.current) {
            try { pc.close(); } catch {}
          }
          sharerPeerConnsRef.current.clear();
          localScreenStreamRef.current = null;
        };
      }
      socket?.emit('start-screenshare');
    } catch (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) {
        addToast('Screen capture permission denied. You can try again.', 'error');
      } else {
        addToast('Failed to start screen share.', 'error');
      }
      setIsSharingScreen(false);
      localScreenStreamRef.current = null;
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

  // Socket: screen share signaling
  useEffect(() => {
    if (!socket) return;

    const onActive = ({ sharerIds }) => {
      setActiveSharerIds(Array.isArray(sharerIds) ? sharerIds : []);
    };
    const onStarted = ({ sharerId }) => {
      setActiveSharerIds(prev => Array.from(new Set([...prev, sharerId])));
    };
    const onStopped = ({ sharerId }) => {
      setActiveSharerIds(prev => prev.filter(id => id !== sharerId));
      // As viewer: close connection and show placeholder
      const pc = viewerPeerConnsRef.current.get(sharerId);
      if (pc) {
        try { pc.close(); } catch {}
        viewerPeerConnsRef.current.delete(sharerId);
      }
      updateScreenTile(sharerId, { ended: true });
    };

    const onSubscribe = async ({ from }) => {
      // I am sharer, viewer requests subscription
      if (!isSharingScreen || !localScreenStreamRef.current) return;
      if (sharerPeerConnsRef.current.has(from)) {
        try { sharerPeerConnsRef.current.get(from).close(); } catch {}
        sharerPeerConnsRef.current.delete(from);
      }
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      sharerPeerConnsRef.current.set(from, pc);
      for (const track of localScreenStreamRef.current.getTracks()) {
        try { track.contentHint = 'detail'; } catch {}
        pc.addTrack(track, localScreenStreamRef.current);
      }
      try {
        const senders = pc.getSenders();
        for (const sender of senders) {
          if (sender.track && sender.track.kind === 'video') {
            const p = sender.getParameters();
            p.encodings = [{ maxBitrate: 1_500_000, scaleResolutionDownBy: 1 }];
            try { await sender.setParameters(p); } catch {}
          }
        }
      } catch {}
      pc.onicecandidate = (ev) => {
        if (ev.candidate) socket.emit('webrtc-ice-candidate', { to: from, candidate: ev.candidate });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
          try { pc.close(); } catch {}
          sharerPeerConnsRef.current.delete(from);
        }
      };
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', { to: from, sdp: pc.localDescription });
      } catch (e) {
        try { pc.close(); } catch {}
        sharerPeerConnsRef.current.delete(from);
      }
    };

    const onUnsubscribe = ({ from }) => {
      const pc = sharerPeerConnsRef.current.get(from);
      if (pc) {
        try { pc.close(); } catch {}
        sharerPeerConnsRef.current.delete(from);
      }
    };

    const onOffer = async ({ from, sdp }) => {
      // I am viewer receiving offer from sharer
      let pc = viewerPeerConnsRef.current.get(from);
      if (pc) {
        try { pc.close(); } catch {}
        viewerPeerConnsRef.current.delete(from);
      }
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      viewerPeerConnsRef.current.set(from, pc);
      pc.onicecandidate = (ev) => {
        if (ev.candidate) socket.emit('webrtc-ice-candidate', { to: from, candidate: ev.candidate });
      };
      pc.ontrack = (ev) => {
        const [stream] = ev.streams;
        // store stream for full-screen reuse
        viewerStreamsRef.current.set(from, stream);
        ensureScreenTile(from, (users.find(u => u.id === from)?.name) || 'Screen');
        const tryAttach = () => {
          const videoEl = document.getElementById(`screen-video-${from}`);
          if (videoEl && videoEl instanceof HTMLVideoElement) {
            try { videoEl.srcObject = stream; } catch {}
            // auto-open full-screen on first frame if not already
            if (!fullScreenSharerId) {
              setFullScreenSharerId(from);
            }
            // notify server I'm watching
            try { socket.emit('viewer-started-watching', { sharerId: from }); } catch {}
            return true;
          }
          return false;
        };
        if (!tryAttach()) {
          setTimeout(() => { tryAttach(); }, 50);
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
          try { pc.close(); } catch {}
          viewerPeerConnsRef.current.delete(from);
        }
      };
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { to: from, sdp: pc.localDescription });
      } catch (e) {
        try { pc.close(); } catch {}
        viewerPeerConnsRef.current.delete(from);
      }
    };

    const onAnswer = async ({ from, sdp }) => {
      // I am sharer receiving viewer's answer
      const pc = sharerPeerConnsRef.current.get(from);
      if (!pc) return;
      try { await pc.setRemoteDescription(new RTCSessionDescription(sdp)); } catch {}
    };

    const onIce = async ({ from, candidate }) => {
      let pc = sharerPeerConnsRef.current.get(from);
      if (!pc) pc = viewerPeerConnsRef.current.get(from);
      if (!pc) return;
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    };

    socket.on('screenshare-active', onActive);
    socket.on('screenshare-started', onStarted);
    socket.on('screenshare-stopped', onStopped);
    socket.on('screenshare-subscribe', onSubscribe);
    socket.on('screenshare-unsubscribe', onUnsubscribe);
    socket.on('webrtc-offer', onOffer);
    socket.on('webrtc-answer', onAnswer);
    const onWatchers = ({ sharerId, watchers }) => {
      setWatchersBySharerId(prev => ({ ...prev, [sharerId]: Array.isArray(watchers) ? watchers : [] }));
    };

    socket.on('webrtc-ice-candidate', onIce);
    socket.on('screenshare-watchers', onWatchers);

    return () => {
      socket.off('screenshare-active', onActive);
      socket.off('screenshare-started', onStarted);
      socket.off('screenshare-stopped', onStopped);
      socket.off('screenshare-subscribe', onSubscribe);
      socket.off('screenshare-unsubscribe', onUnsubscribe);
      socket.off('webrtc-offer', onOffer);
      socket.off('webrtc-answer', onAnswer);
      socket.off('webrtc-ice-candidate', onIce);
      socket.off('screenshare-watchers', onWatchers);
    };
  }, [socket, users, isSharingScreen]);

  // Proximity-based auto subscribe/unsubscribe
  useEffect(() => {
    if (!socket || !user) return;
    const subscribedSharers = new Set(viewerPeerConnsRef.current.keys());
    // Subscribe to newly eligible sharers
    for (const sharerId of eligibleSharerIds) {
      if (!subscribedSharers.has(sharerId)) {
        socket.emit('screenshare-subscribe', { sharerId });
        // Prepare tile immediately for smooth appear
        ensureScreenTile(sharerId, (users.find(u => u.id === sharerId)?.name) || 'Screen');
      }
    }
    // Unsubscribe from those no longer eligible
    for (const sharerId of subscribedSharers) {
      if (!eligibleSharerIds.includes(sharerId)) {
        socket.emit('screenshare-unsubscribe', { sharerId });
        const pc = viewerPeerConnsRef.current.get(sharerId);
        if (pc) { try { pc.close(); } catch {} }
        viewerPeerConnsRef.current.delete(sharerId);
        removeScreenTile(sharerId);
        try { socket.emit('viewer-stopped-watching', { sharerId }); } catch {}
        if (fullScreenSharerId === sharerId) {
          // if current full-screen left range, switch to another eligible or exit
          const next = eligibleSharerIds.find(id => id !== sharerId) || null;
          setFullScreenSharerId(next || null);
        }
      }
    }
  }, [eligibleSharerIds, socket, user, users]);

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
            isSharingActive={isSharingScreen}
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
              isSharingActive={activeSharerIds.includes(user.id)}
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
      {user && nearbyUsers.length > 0 && !fullScreenSharerId && (
        <div
          style={{
            position: 'fixed',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'grid',
            gridAutoFlow: 'column',
            gap: 14,
            padding: 8,
            borderRadius: 12,
            background: 'rgba(17,17,17,0.6)',
            backdropFilter: 'blur(6px)',
            zIndex: 12500,
            boxShadow: '0 10px 28px rgba(0,0,0,0.35)'
          }}
        >
              {nearbyUsers.map((u) => {
            const isSelected = activeSharerIds.includes(u.id);
                const isMinimizedHere = isSelected && minimizedSharerIds.includes(u.id);
            return (
              <div
                key={u.id}
                id={`nearby-card-${u.id}`}
                title={u.name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMinimizedHere ? undefined : '40px 1fr',
                  alignItems: 'center',
                  minWidth: isMinimizedHere ? 260 : 180,
                  minHeight: isMinimizedHere ? 160 : undefined,
                  padding: isMinimizedHere ? 8 : '10px 12px',
                  borderRadius: 12,
                  border: isSelected ? '2px solid #64FFDA' : '1px solid rgba(255,255,255,0.18)',
                  background: isSelected ? 'rgba(100,255,218,0.12)' : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  cursor: isSelected ? 'pointer' : 'default',
                  overflow: 'hidden'
                }}
                    onClick={() => { if (isSelected && !isMinimizedHere) { setFullScreenSharerId(u.id); removeMinimizedSharer(u.id); } }}
              >
                {isMinimizedHere ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <video
                      id={`screen-video-inline-${u.id}`}
                      autoPlay
                      muted
                      playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', borderRadius: 8 }}
                      ref={(el) => {
                        const stream = viewerStreamsRef.current.get(u.id);
                        if (el && stream && el.srcObject !== stream) {
                          try { el.srcObject = stream; } catch {}
                        }
                      }}
                    />
                    <div style={{ position: 'absolute', left: 8, bottom: 8, right: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{u.avatar || '🖥️'}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                          <span style={{ fontSize: 12, fontWeight: 800 }}>{u.name}</span>
                          <span style={{ fontSize: 10, opacity: 0.9 }}>Screen Share</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          title="Maximize"
                          onClick={(e) => { e.stopPropagation(); setFullScreenSharerId(u.id); removeMinimizedSharer(u.id); }}
                          style={{ border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', borderRadius: 6, height: 22, padding: '0 6px', cursor: 'pointer' }}
                        >⤢</button>
                        <button
                          title="Close"
                          onClick={(e) => {
                            e.stopPropagation();
                            try { socket?.emit('screenshare-unsubscribe', { sharerId: u.id }); } catch {}
                            const pc = viewerPeerConnsRef.current.get(u.id);
                            if (pc) { try { pc.close(); } catch {} }
                            viewerPeerConnsRef.current.delete(u.id);
                            removeScreenTile(u.id);
                            try { socket?.emit('viewer-stopped-watching', { sharerId: u.id }); } catch {}
                            removeMinimizedSharer(u.id);
                          }}
                          style={{ border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', borderRadius: 6, height: 22, padding: '0 6px', cursor: 'pointer' }}
                        >×</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 24 }}>{u.avatar || '👤'}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                      <span style={{ fontSize: 11, opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isSelected ? 'Screen Share' : 'Nearby'}</span>
                    </div>
                  </>
                )}
              </div>
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

      {user && !fullScreenSharerId && (
        <div style={{ position: 'fixed', bottom: 20, left: 20, display: 'flex', gap: 8, zIndex: 11000 }}>
          <button
            aria-label="Toggle screen share"
            onClick={toggleScreenShare}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: 'none',
              background: isSharingScreen ? '#FF6B6B' : '#64FFDA',
              color: '#111',
              cursor: 'pointer',
              boxShadow: '0 10px 28px rgba(100,255,218,0.25)'
            }}
            title={isSharingScreen ? 'Stop sharing your screen' : 'Start screen share'}
          >{isSharingScreen ? 'Stop Share' : 'Share Screen'}</button>
        </div>
      )}

      {/* Screen tiles (viewer side) */}
      {/* Legacy floating tiles still supported for non-minimized sharers */}
      {user && !fullScreenSharerId && Object.entries(screenTiles).some(([sid]) => !minimizedSharerIds.includes(sid)) && (
        <>
          {Object.entries(screenTiles).filter(([sid]) => !minimizedSharerIds.includes(sid)).map(([sharerId, layout]) => (
            <div
              key={sharerId}
              style={{
                position: 'fixed',
                left: layout.left,
                top: layout.top,
                width: layout.width,
                height: layout.height,
                zIndex: 12000,
                background: 'rgba(10,10,10,0.85)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                overflow: 'hidden',
                boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                transition: 'opacity 220ms ease',
                opacity: layout.visible ? 1 : 0
              }}
              onMouseDown={(e) => {
                // Bring to front by bumping z-index slightly
                e.currentTarget.style.zIndex = 13000;
              }}
            >
              <div
                style={{
                  height: 42,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  background: 'rgba(255,255,255,0.06)',
                  padding: '0 8px',
                  cursor: 'move',
                  userSelect: 'none'
                }}
                onMouseDown={(e) => {
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const startLeft = layout.left;
                  const startTop = layout.top;
                  function onMove(ev) {
                    updateScreenTile(sharerId, { left: Math.max(0, startLeft + (ev.clientX - startX)), top: Math.max(0, startTop + (ev.clientY - startY)) });
                  }
                  function onUp() {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  }
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
              >
                <div style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{layout.title || 'Screen'}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    title="Maximize"
                    onClick={() => { setFullScreenSharerId(sharerId); setMinimizedSharerIds([]); }}
                    style={{ border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: 6, height: 24, padding: '0 8px', cursor: 'pointer' }}
                  >⤢</button>
                  <button
                    title="Close"
                    onClick={() => {
                      // As viewer: unsubscribe and close
                      try { socket?.emit('screenshare-unsubscribe', { sharerId }); } catch {}
                      const pc = viewerPeerConnsRef.current.get(sharerId);
                      if (pc) { try { pc.close(); } catch {} }
                      viewerPeerConnsRef.current.delete(sharerId);
                      removeScreenTile(sharerId);
                      try { socket?.emit('viewer-stopped-watching', { sharerId }); } catch {}
                      removeMinimizedSharer(sharerId);
                    }}
                    style={{ border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: 6, height: 24, padding: '0 8px', cursor: 'pointer' }}
                  >×</button>
                </div>
              </div>
              <div style={{ position: 'relative', width: '100%', height: `calc(100% - 32px)` }}>
                {layout.ended ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b0b0b0', fontSize: 14 }}>
                    Screen share has ended
                  </div>
                ) : (
                  <video
                    id={`screen-video-${sharerId}`}
                    autoPlay
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
                    ref={(el) => {
                      const stream = viewerStreamsRef.current.get(sharerId);
                      if (el && stream && el.srcObject !== stream) {
                        try { el.srcObject = stream; } catch {}
                      }
                    }}
                  />
                )}
                {/* Resize handle */}
                <div
                  style={{ position: 'absolute', right: 4, bottom: 4, width: 16, height: 16, cursor: 'nwse-resize', background: 'rgba(255,255,255,0.2)', borderRadius: 4 }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startW = layout.width;
                    const startH = layout.height;
                    function onMove(ev) {
                      updateScreenTile(sharerId, { width: Math.max(240, startW + (ev.clientX - startX)), height: Math.max(140, startH + (ev.clientY - startY)) });
                    }
                    function onUp() {
                      window.removeEventListener('mousemove', onMove);
                      window.removeEventListener('mouseup', onUp);
                    }
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                />
              </div>
            </div>
          ))}
        </>
      )}

      {user && !isChatOpen && !fullScreenSharerId && (
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

      {/* Full-screen overlay */}
      {user && fullScreenSharerId && (
        <div
          className="ss-overlay"
          onMouseMove={() => {
            setFsControlsVisible(true);
            if (fsHideTimerRef.current) clearTimeout(fsHideTimerRef.current);
            fsHideTimerRef.current = setTimeout(() => setFsControlsVisible(false), 2500);
          }}
        >
          {/* Viewer list left side */}
          <div className={`ss-viewers ${fsViewersExpanded ? 'expanded' : ''}`}>
            {(() => {
              // Show all nearby users as title cards on the left during full-screen
              const list = nearbyUsers;
              const collapsed = !fsViewersExpanded ? list.slice(0, 8) : list;
              const hasMore = list.length > collapsed.length;
              return (
                <>
                  <div className="ss-viewers-scroll">
                    {collapsed.map(w => {
                      const isSharer = activeSharerIds.includes(w.id);
                      return (
                        <div
                          key={w.id}
                          className="ss-avatar"
                          title={w.name}
                          onClick={() => {
                            if (!isSharer) return;
                            setFullScreenSharerId(w.id);
                          }}
                          style={{ cursor: isSharer ? 'pointer' : 'default', outline: w.id === fullScreenSharerId ? '2px solid #64FFDA' : undefined }}
                        >
                          <span className="ss-avatar-emoji">{w.avatar || '👤'}</span>
                          {fsViewersExpanded && (<span className="ss-avatar-name">{w.name}</span>)}
                        </div>
                      );
                    })}
                  </div>
                  {hasMore && (
                    <button className="ss-viewers-more" title="Show more viewers" onClick={() => setFsViewersExpanded(true)}>▼</button>
                  )}
                  {fsViewersExpanded && list.length > 8 && (
                    <button className="ss-viewers-more" title="Collapse" onClick={() => setFsViewersExpanded(false)}>▲</button>
                  )}
                </>
              );
            })()}
          </div>

          {/* Video area */}
          <div key={fullScreenSharerId} className="ss-video-wrap">
            {(() => {
              const stream = viewerStreamsRef.current.get(fullScreenSharerId);
              return (
                <video
                  id={`screen-video-fs-${fullScreenSharerId}`}
                  autoPlay
                  muted
                  playsInline
                  className="ss-video fade-in"
                  ref={(el) => { if (el && stream && el.srcObject !== stream) { try { el.srcObject = stream; } catch {} } }}
                />
              );
            })()}
          </div>

          {/* Bottom sharer switcher */}
          {eligibleSharerIds.length > 1 && (
            <div className="ss-switcher">
              {eligibleSharerIds.map(id => {
                const u = users.find(x => x.id === id);
                const isActive = id === fullScreenSharerId;
                return (
                  <button key={id} className={`ss-switcher-item ${isActive ? 'active' : ''}`} title={u?.name || 'Screen'} onClick={() => setFullScreenSharerId(id)}>
                    <span className="ss-switcher-emoji">{u?.avatar || '🖥️'}</span>
                    <span className="ss-switcher-name">{u?.name || 'Screen'}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Controls toolbar */}
          <div className="ss-toolbar" style={{ display: fsControlsVisible ? 'flex' : 'none' }}>
            <button
              className="ss-btn"
              onClick={() => {
                const sid = fullScreenSharerId;
                setFullScreenSharerId(null);
                if (sid) { dockScreenTileToAnchor(sid); addMinimizedSharer(sid); }
              }}
              title="Minimize"
            >⤡</button>
            {eligibleSharerIds.length > 1 && (
              <button
                className="ss-btn primary"
                onClick={() => {
                  const ids = eligibleSharerIds;
                  const idx = ids.indexOf(fullScreenSharerId);
                  const next = ids[(idx + 1) % ids.length];
                  setFullScreenSharerId(next);
                }}
                title="Switch Stream"
              >⇄</button>
            )}
          </div>
        </div>
      )}

      {/* Toasts */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 14000, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {toasts.map(t => (
            <div key={t.id} style={{ padding: '8px 12px', borderRadius: 8, background: t.type === 'error' ? 'rgba(255,59,48,0.15)' : 'rgba(17,17,17,0.75)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)' }}>
              {t.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
