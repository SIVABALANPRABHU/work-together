import React, { useEffect, useRef } from 'react';

const Character = ({ user, onMove, isCurrentUser, showRadius = false, radiusTiles = 3 }) => {
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
          newPos.y = Math.min(23, currentPos.y + 1);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          newPos.x = Math.max(1, currentPos.x - 1);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          newPos.x = Math.min(28, currentPos.x + 1);
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

  return (
    <div style={{ position: 'absolute', left: `${user.position.x * 3.33}%`, top: `${user.position.y * 4}%`, zIndex: 1000 }}>
      {showRadius && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '-50%',
            top: '-50%',
            width: `${radiusTiles * 2 * 3.33}%`,
            height: `${radiusTiles * 2 * 4}%`,
            borderRadius: '50%',
            border: '2px dashed rgba(100,255,218,0.5)',
            background: 'radial-gradient(circle, rgba(100,255,218,0.08) 0%, rgba(100,255,218,0.02) 60%, rgba(0,0,0,0) 70%)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
      )}

      <div
        ref={characterRef}
        className="character"
        style={{
          position: 'relative',
          backgroundColor: getAvatarColor(user.avatar),
          border: isCurrentUser ? '3px solid #64FFDA' : '2px solid #ffffff',
        }}
        title={user.name}
      >
        {user.avatar}
        <div className="character-name">{user.name}</div>
      </div>
    </div>
  );
};

export default Character;
