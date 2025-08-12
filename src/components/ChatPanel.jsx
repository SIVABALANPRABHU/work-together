import React, { useState, useEffect, useRef } from 'react';

const ChatPanel = ({
  messages,
  onSendMessage,
  currentUser,
  account,
  users = [],
  dmPeerId,
  onSelectPeer,
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

  return (
    <div className="chat-panel" style={{ display: 'flex', height: '100%' }}>
      {/* Sidebar: user list */}
      <div style={{ width: 220, borderRight: '1px solid #2d2d5f', background: '#13132a', overflowY: 'auto' }}>
        <div style={{ padding: '10px', fontWeight: 700, color: '#b0b0b0' }}>Users</div>
        <div>
          {users.map((u) => {
            const isSelected = dmPeerId === u.id;
            return (
              <button
                key={u.id}
                onClick={() => onSelectPeer?.(u.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  background: isSelected ? '#1e1e3f' : 'transparent',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  borderLeft: isSelected ? '3px solid #64ffda' : '3px solid transparent'
                }}
              >
                <span style={{ marginRight: 8 }}>{u.avatar || '👤'}</span>
                <span>{u.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="chat-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 600 }}>
            {(() => {
              const peer = users.find(u => u.id === dmPeerId);
              return peer ? `Chat with ${peer.name}` : 'Select a user to start chatting';
            })()}
          </div>
        </div>

        <div className="chat-messages">
          {dmPeerId && messages.map((message, index) => (
            <div key={index} className="message">
              <div className="message-name">
                {renderName(message)} {isFromMe(message) && '(You)'}
              </div>
              <div className="message-text">{message.message}</div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
                {formatTime(message.timestamp)}
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
            placeholder={dmPeerId ? 'Type a message...' : 'Select a user to start chatting'}
            maxLength={200}
            disabled={!dmPeerId}
          />
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;
