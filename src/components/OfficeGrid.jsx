import React from 'react';
import { officeLayout, officeObjects } from '../data/officeData';

const OfficeGrid = ({ currentRoom }) => {
  const currentLayout = officeLayout[currentRoom] || officeLayout['main-office'];
  const currentObjects = officeObjects[currentRoom] || officeObjects['main-office'];

  const renderOfficeObject = (obj) => {
    const baseStyle = {
      position: 'absolute',
      left: `${obj.x * 5}%`,
      top: `${obj.y * 6.67}%`,
      width: '5%',
      height: '6.67%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      zIndex: 10
    };

    switch (obj.type) {
      case 'desk-wood':
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object desk-wood">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%' }}>
              <div style={{ fontSize: '16px', marginBottom: '2px' }}>🖥️</div>
              {obj.hasComputer && <div style={{ fontSize: '12px' }}>💻</div>}
              {obj.hasMonitor && <div style={{ fontSize: '14px', position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)' }}>🖥️</div>}
              {obj.hasKeyboard && <div style={{ fontSize: '10px', position: 'absolute', bottom: '2px', left: '2px' }}>⌨️</div>}
              {obj.hasMouse && <div style={{ fontSize: '10px', position: 'absolute', bottom: '2px', right: '2px' }}>🖱️</div>}
              {obj.hasPlant && <div style={{ fontSize: '10px', position: 'absolute', top: '2px', right: '2px' }}>🌱</div>}
              {obj.hasLamp && <div style={{ fontSize: '10px', position: 'absolute', top: '2px', left: '2px' }}>💡</div>}
              {obj.hasCoffee && <div style={{ fontSize: '10px', position: 'absolute', bottom: '2px', left: '2px' }}>☕</div>}
              {obj.hasNotebook && <div style={{ fontSize: '10px', position: 'absolute', bottom: '2px', right: '2px' }}>📓</div>}
              {obj.hasPhone && <div style={{ fontSize: '10px', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>📱</div>}
              {obj.hasBooks && <div style={{ fontSize: '10px', position: 'absolute', bottom: '2px', right: '2px' }}>📚</div>}
            </div>
          </div>
        );
      
      case 'office-chair':
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object office-chair">
            🪑
          </div>
        );
      
      case 'kitchen-counter':
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object kitchen-counter">
            🍽️
          </div>
        );
      
      case 'sink':
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object sink">
            🚰
          </div>
        );
      
      case 'refrigerator':
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object refrigerator">
            🧊
          </div>
        );
      
      case 'coffee-machine':
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object coffee-machine">
            ☕
          </div>
        );
      
      case 'microwave':
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object microwave">
            🔥
          </div>
        );
      
      case 'lounge-sofa':
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object lounge-sofa">
            🛋️
          </div>
        );
      
      case 'coffee-table':
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object coffee-table">
            🫖
          </div>
        );
      
      case 'lounge-chair':
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object lounge-chair">
            🪑
          </div>
        );
      
      case 'plant-large':
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object plant-large">
            🌳
          </div>
        );
      
      case 'window':
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object window">
            🪟
          </div>
        );
      
      case 'conference-table':
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object conference-table">
            🗣️
          </div>
        );
      
      case 'conference-chair':
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object conference-chair">
            🪑
          </div>
        );
      
      case 'filing-cabinet':
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object filing-cabinet">
            📁
          </div>
        );
      
      case 'printer':
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object printer">
            🖨️
          </div>
        );
      
      case 'water-cooler':
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object water-cooler">
            💧
          </div>
        );
      
      default:
        return (
          <div key={`${obj.x}-${obj.y}`} style={baseStyle} className="office-object">
            📦
          </div>
        );
    }
  };

  return (
    <div className="office-grid" style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${currentLayout.grid[0].length}, 1fr)`,
      gridTemplateRows: `repeat(${currentLayout.grid.length}, 1fr)`,
      width: '100%',
      height: '100%',
      position: 'relative'
    }}>
      {currentLayout.grid.map((row, y) =>
        row.map((tile, x) => (
          <div
            key={`${x}-${y}`}
            className={`office-tile ${tile === 'W' ? 'wall' : 'floor'}`}
          />
        ))
      )}
      
      <div className="office-objects">
        {currentObjects.map(obj => renderOfficeObject(obj))}
      </div>
    </div>
  );
};

export default OfficeGrid;
