import React, { useEffect, useRef } from 'react';

const Character = ({ user, onMove, isCurrentUser }) => {
  const characterRef = useRef(null);

  useEffect(() => {
    if (!isCurrentUser) return;

    const handleKeyDown = (e) => {
      const currentPos = { ...user.position };
      let newPos = { ...currentPos };

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          newPos.y = Math.max(1, currentPos.y - 1);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          newPos.y = Math.min(13, currentPos.y + 1);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          newPos.x = Math.max(1, currentPos.x - 1);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          newPos.x = Math.min(18, currentPos.x + 1);
          break;
        default:
          return;
      }

      if (newPos.x !== currentPos.x || newPos.y !== currentPos.y) {
        onMove(newPos);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user.position, onMove, isCurrentUser]);

  const getAvatarColor = (avatar) => {
    const colors = {
      '👨': '#4A90E2',
      '👩': '#E91E63',
      '👦': '#8BC34A',
      '👧': '#FF9800',
      '🧑': '#9C27B0',
      '👴': '#607D8B',
      '👵': '#FF5722',
      '🤖': '#795548'
    };
    return colors[avatar] || '#64FFDA';
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div
      ref={characterRef}
      className="character"
      style={{
        left: `${user.position.x * 5}%`,
        top: `${user.position.y * 6.67}%`,
        backgroundColor: getAvatarColor(user.avatar),
        border: isCurrentUser ? '3px solid #64FFDA' : '2px solid #ffffff'
      }}
      title={user.name}
    >
      {user.avatar}
      <div className="character-name">{user.name}</div>
    </div>
  );
};

export default Character;
