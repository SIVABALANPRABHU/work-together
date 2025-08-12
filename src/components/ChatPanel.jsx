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
              <button className="panel-close" onClick={() => onClose?.()} aria-label="Close chat">✕</button>
            )}
          </div>
          <div style={{ padding: '12px 15px 10px', borderBottom: '1px solid rgba(245,158,11,0.18)' }}>
            <input
              type="text"
              className="chat-search"
              placeholder="Search users…"
              onChange={(e) => {
                const val = e.target.value.toLowerCase();
                const list = Array.from(document.querySelectorAll('.chat-user-item'));
                list.forEach(el => {
                  const name = (el.getAttribute('data-name') || '').toLowerCase();
                  el.style.display = name.includes(val) ? 'flex' : 'none';
                });
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', padding: '0 15px 12px', flex: 1 }}>
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
                    gap: 12,
                    textAlign: 'left',
                    padding: '12px 10px',
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    borderRadius: 10
                  }}
                >
                  <span style={{ fontSize: 18, width: 26, textAlign: 'center' }}>{u.avatar || '👤'}</span>
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
            <button className="back-btn" onClick={() => onSelectPeer?.(null)}><span style={{ marginRight: 6 }}>←</span>Back</button>
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
