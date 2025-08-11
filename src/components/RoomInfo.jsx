import React from 'react';
import { officeLayout } from '../data/officeData';

const RoomInfo = ({ currentRoom, userCount, isConnected }) => {
  const currentRoomData = officeLayout[currentRoom];

  return (
    <div className="room-info">
      <h3>{currentRoomData?.name || 'Unknown Room'}</h3>
      <p>Users Online: {userCount}</p>
      <p>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
      <p>Room: {currentRoom}</p>
    </div>
  );
};

export default RoomInfo;
