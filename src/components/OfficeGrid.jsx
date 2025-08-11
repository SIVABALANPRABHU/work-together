import React from 'react';

const OfficeGrid = ({ layout, objects, currentRoom }) => {
  const currentLayout = layout[currentRoom];
  const currentObjects = objects[currentRoom] || [];

  if (!currentLayout) return null;

  const getTileClass = (tileType) => {
    switch (tileType) {
      case 'W': return 'office-tile wall';
      case 'D': return 'office-tile door';
      case 'F': return 'office-tile';
      default: return 'office-tile';
    }
  };

  const getObjectIcon = (type) => {
    switch (type) {
      case 'desk': return '🖥️';
      case 'chair': return '🪑';
      case 'plant': return '🌱';
      case 'coffee': return '☕';
      default: return '📦';
    }
  };

  return (
    <div className="office-container">
      <div className="office-grid">
        {currentLayout.grid.map((row, rowIndex) => (
          row.map((tile, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={getTileClass(tile)}
              style={{
                gridColumn: colIndex + 1,
                gridRow: rowIndex + 1
              }}
            />
          ))
        ))}
      </div>
      
      <div className="office-objects">
        {currentObjects.map((obj, index) => (
          <div
            key={index}
            className={`office-object ${obj.type}`}
            style={{
              left: `${obj.x * 5}%`,
              top: `${obj.y * 6.67}%`,
              width: obj.width ? `${obj.width * 5}%` : '40px',
              height: obj.height ? `${obj.height * 6.67}%` : '40px'
            }}
          >
            {getObjectIcon(obj.type)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default OfficeGrid;
