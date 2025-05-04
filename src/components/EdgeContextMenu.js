import React from 'react';

const EdgeContextMenu = ({ x, y, onSelect, onClose }) => {
  // Prevent clicks inside the menu from closing it
  const handleMenuClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="edge-context-menu" 
      style={{
        position: 'absolute',
        top: `${y}px`,
        left: `${x}px`,
        zIndex: 10,
        backgroundColor: 'white',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
        borderRadius: '4px',
        padding: '5px',
        minWidth: '150px'
      }}
      onClick={handleMenuClick}
    >
      <div 
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          hoverBackground: '#f0f0f0',
          borderBottom: '1px solid #eee'
        }}
        onClick={() => onSelect('JCBox')}
      >
        Add New JCBox
      </div>
      <div 
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          hoverBackground: '#f0f0f0'
        }}
        onClick={() => onSelect('Loop')}
      >
        Add Loop
      </div>
    </div>
  );
};

export default EdgeContextMenu; 