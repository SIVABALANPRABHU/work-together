import React, { useState, useEffect, useRef } from 'react';

const ChatPanel = ({ messages, onSendMessage, currentUser }) => {
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

  return (
    <div className="chat-panel">
      <div className="chat-header">
        Office Chat
      </div>
      
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className="message">
            <div className="message-name">
              {message.name} {message.id === currentUser.id && '(You)'}
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
          placeholder="Type a message..."
          maxLength={200}
        />
      </form>
    </div>
  );
};

export default ChatPanel;
