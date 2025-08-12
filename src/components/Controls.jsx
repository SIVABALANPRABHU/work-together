import React, { useState } from 'react';

const Controls = ({ onJoinOffice, onRoomChange, currentRoom, user, account, collapsed, onToggle }) => {
  const [formData, setFormData] = useState({
    name: account?.name || localStorage.getItem('user_name') || '',
    avatar: account?.avatar || localStorage.getItem('user_avatar') || '👨'
  });

  const avatars = ['👨', '👩', '👦', '👧', '🧑', '👴', '👵', '🤖'];
  const rooms = [
    { id: 'main-office', name: 'Main Office' },
    { id: 'meeting-room', name: 'Meeting Room' },
    { id: 'break-room', name: 'Break Room' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!localStorage.getItem('token')) return;
    if (formData.name.trim()) onJoinOffice(formData);
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (user) {
    return (
      <div className="controls">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h3>Office Controls</h3>
          <button className="panel-close" onClick={onToggle} aria-label={collapsed ? 'Open controls' : 'Close controls'}>{collapsed ? '⚙' : '✕'}</button>
        </div>
        {collapsed ? null : (
        <>
        <div className="control-group">
          <label>Current Room:</label>
          <select 
            value={currentRoom} 
            onChange={(e) => onRoomChange(e.target.value)}
          >
            {rooms.map(room => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="control-group">
          <label>Movement:</label>
          <p style={{ fontSize: '12px', color: '#b0b0b0', marginTop: '5px' }}>
            Use WASD or Arrow Keys to move
          </p>
        </div>

        <div className="control-group">
          <label>Current User:</label>
          <p style={{ color: '#64ffda', marginTop: '5px' }}>
            {user.name} ({user.avatar})
          </p>
        </div>
        </>
        )}
      </div>
    );
  }

  return (
    <div className="controls">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3>Join Virtual Office</h3>
        <button className="panel-close" onClick={onToggle} aria-label={collapsed ? 'Open controls' : 'Close controls'}>{collapsed ? '⚙' : '✕'}</button>
      </div>
      {collapsed ? null : (
      <form onSubmit={handleSubmit}>
        <div className="control-group">
          <label htmlFor="name">Your Name:</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Enter your name"
            required
          />
        </div>

        <div className="control-group">
          <label htmlFor="avatar">Choose Avatar:</label>
          <select
            id="avatar"
            name="avatar"
            value={formData.avatar}
            onChange={handleInputChange}
          >
            {avatars.map(avatar => (
              <option key={avatar} value={avatar}>
                {avatar} {avatar === '👨' ? 'Person' : ''}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn">
          Enter Office
        </button>
      </form>
      )}
    </div>
  );
};

export default Controls;
