import React, { useEffect, useRef } from 'react';

const Character = ({ user, onMove, isCurrentUser, showRadius = false, radiusTiles = 3, isSharingActive = false, onClick }) => {
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

  const presence = user.presence || 'available';
  const presenceColor = presence === 'dnd' ? '#EF4444' : presence === 'busy' ? '#F59E0B' : '#10B981';

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
          boxShadow: isSharingActive ? '0 0 0 2px rgba(239,68,68,0.9), 0 0 18px rgba(239,68,68,0.7)' : undefined
        }}
        title={user.name}
        onClick={onClick}
      >
        {user.avatar}
        <div className="character-name" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: presenceColor }} />
          {user.name}
        </div>
        {isSharingActive && (
          <div style={{ position: 'absolute', top: -8, right: -8, width: 14, height: 14, background: '#EF4444', borderRadius: '50%', border: '2px solid #111' }} />
        )}
      </div>
    </div>
  );
};

export default Character;
