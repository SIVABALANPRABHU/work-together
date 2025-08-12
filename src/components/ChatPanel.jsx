import React, { useState, useEffect, useRef } from 'react';

const ChatPanel = ({
  messages,
  onSendMessage,
  currentUser,
  account,
  users = [],
  dmPeerId,
  onSelectPeer,
  dmThreads = {},
  unreadByUserId = {},
  onClose,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isFromMe = (message) => {
    return message.fromUserId === account?.id;
  };

  const renderName = (message) => {
    return message.fromName;
  };

  // Single-pane UX: list OR conversation
  return (
    <div className="chat-panel" style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      {!dmPeerId ? (
        <>
          <div className="chat-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Chats</span>
            {onClose && (
              <button className="btn" onClick={() => onClose?.()} style={{ padding: '6px 10px' }}>Close</button>
            )}
          </div>
          <div style={{ padding: '10px' }}>
            <input
              type="text"
              placeholder="Search users…"
              onChange={(e) => {
                const val = e.target.value.toLowerCase();
                const list = Array.from(document.querySelectorAll('.chat-user-item'));
                list.forEach(el => {
                  const name = (el.getAttribute('data-name') || '').toLowerCase();
                  el.style.display = name.includes(val) ? 'flex' : 'none';
                });
              }}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #2d2d5f', background: '#0f0f23', color: '#fff' }}
            />
          </div>
          <div style={{ overflowY: 'auto' }}>
            {users.map((u) => {
              const unread = unreadByUserId[u.id] || 0;
              return (
                <button
                  key={u.id}
                  className="chat-user-item"
                  data-name={u.name}
                  onClick={() => onSelectPeer?.(u.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    textAlign: 'left',
                    padding: '12px 14px',
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: 18 }}>{u.avatar || '👤'}</span>
                  <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                  {unread > 0 && (
                    <span style={{ background: '#4F46E5', color: '#fff', borderRadius: 999, padding: '2px 6px', fontSize: 12, fontWeight: 700 }}>{unread}</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="chat-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn" onClick={() => onSelectPeer?.(null)} style={{ padding: '6px 10px' }}>Back</button>
            <div style={{ fontWeight: 600 }}>
              {(() => {
                const peer = users.find(u => u.id === dmPeerId);
                return peer ? peer.name : '';
              })()}
            </div>
          </div>
          <div className="chat-messages">
            {messages.map((message, index) => (
              <div key={index} className={`message ${isFromMe(message) ? 'me' : 'them'}`}>
                <div className="bubble">
                  <div className="meta">
                    <span className="name">{isFromMe(message) ? 'You' : message.fromName}</span>
                    <span className="time">{formatTime(message.timestamp)}</span>
                  </div>
                  <div className="text">{message.message}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSubmit} className="chat-input">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={'Type a message...'}
              maxLength={200}
            />
          </form>
        </>
      )}
    </div>
  );
};

export default ChatPanel;
