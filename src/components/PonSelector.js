import React from 'react';

const PonSelector = ({ 
  x, 
  y, 
  ponOptions, 
  currentPonId, 
  onSelect, 
  onClose 
}) => {
  // Prevent clicks inside the menu from closing it
  const handleMenuClick = (e) => {
    e.stopPropagation();
  };

  // Find the current PON label
  const currentPon = ponOptions.find(p => p.id === currentPonId);
  const currentPonLabel = currentPon ? currentPon.label : 'Unknown';

  return (
    <div 
      className="pon-selector" 
      style={{
        position: 'absolute',
        top: `${y}px`,
        left: `${x}px`,
        zIndex: 10,
        backgroundColor: 'white',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
        borderRadius: '4px',
        padding: '10px',
        minWidth: '220px'
      }}
      onClick={handleMenuClick}
    >
      <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
        Change PON Connection
      </div>
      
      <div style={{ fontSize: '12px', marginBottom: '8px' }}>
        Current: <span style={{ fontWeight: 'bold' }}>{currentPonLabel}</span>
      </div>
      
      <div style={{ fontSize: '12px', marginBottom: '5px' }}>Select new PON:</div>
      
      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {ponOptions.map(pon => (
          <div 
            key={pon.id}
            style={{
              padding: '8px 12px',
              cursor: pon.id === currentPonId ? 'default' : 'pointer',
              backgroundColor: pon.id === currentPonId ? '#f8f9fa' : 'transparent',
              color: pon.id === currentPonId ? '#999' : 'inherit',
              borderRadius: '4px',
              margin: '2px 0'
            }}
            onClick={() => pon.id !== currentPonId && onSelect(pon.id)}
          >
            {pon.label}
            {pon.id === currentPonId && <span style={{ marginLeft: '5px', fontSize: '10px' }}>(current)</span>}
          </div>
        ))}
      </div>
      
      <div style={{ marginTop: '10px', textAlign: 'right' }}>
        <button 
          onClick={onClose}
          style={{
            padding: '5px 10px',
            border: 'none',
            backgroundColor: '#f1f1f1',
            cursor: 'pointer',
            borderRadius: '4px',
            fontSize: '11px'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default PonSelector; 