import React, { useState, useEffect } from 'react';
import { Handle } from '@xyflow/react';

const CustomNode = ({ data }) => {
  const [fields, setFields] = useState({
    title: data.title || '',
    ponOp: data.ponOp || '',
    deviceType: data.deviceType || '',
    splitterType: data.splitterType || '',
    outputOp: data.outputOp || '',
    currentOp: data.currentOp || '',
    distance: data.distance || '',
    fms: data.fms || '',
    fmsPort: data.fmsPort || '',
    description: data.description || '',
    inputOp: data.inputOp || '',
    opPrevious: data.opPrevious || '',
    opCurrent: data.opCurrent || '',
    loop: data.loop || ''
  });

  const [showSplitterOptions, setShowSplitterOptions] = useState(false);
  const [showDeviceOptions, setShowDeviceOptions] = useState(false);

  useEffect(() => {
    // Initialize state based on passed data
    if (data.deviceType === 'Splitter') {
      setShowSplitterOptions(true);
      setShowDeviceOptions(false);
    } else if (data.deviceType === 'Device') {
      setShowSplitterOptions(false);
      setShowDeviceOptions(true);
    }
  }, [data.deviceType]);

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setFields((prevFields) => ({ ...prevFields, [name]: value }));

    if (data.onUpdate) {
      data.onUpdate({ ...fields, [name]: value });
    }
  };

  const handleDeviceTypeChange = (e) => {
    const { value } = e.target;
    
    if (value === 'Splitter') {
      setShowSplitterOptions(true);
      setShowDeviceOptions(false);
    } else if (value === 'Device') {
      setShowSplitterOptions(false);
      setShowDeviceOptions(true);
    } else {
      setShowSplitterOptions(false);
      setShowDeviceOptions(false);
    }

    handleFieldChange(e);
  };

  const handleSplitterChange = (e) => {
    handleFieldChange(e);
    
    if (data.onSplitterSelect) {
      console.log("Splitter selected, node ID:", data.id);
      const selectedValue = e.target.value;
      const numChildren = 
        selectedValue === '1/2' ? 2 :
        selectedValue === '1/4' ? 4 :
        selectedValue === '1/8' ? 8 :
        selectedValue === '1/16' ? 16 : 0;
      
      data.onSplitterSelect(e, data.id, numChildren, selectedValue);
    } else {
      console.error("onSplitterSelect callback is not defined");
    }
  };

  const handleDeviceSelect = (e) => {
    handleFieldChange(e);
    
    if (data.onDeviceSelect) {
      data.onDeviceSelect(e, data.id, e.target.value);
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation(); // Prevent triggering any parent click handlers
    
    // Show confirmation dialog before deleting
    if (window.confirm("Are you sure you want to delete this node?")) {
      if (data.onDelete) {
        data.onDelete(data.id);
      }
    }
  };
  
  const handleChangePonClick = (e) => {
    e.stopPropagation(); // Prevent triggering any parent click handlers
    if (data.openPonSelector) {
      data.openPonSelector(e, data.id, e.clientX, e.clientY);
    }
  };

  // Determine if this node is eligible for deletion
  // We want to show delete button on each node except PON and EPON nodes
  const isDeletableNode = data.label && 
    !data.label.includes('PON') && 
    !data.label.includes('EPON');
    
  // Determine if this is an OLT node that can be rewired
  const isOltNode = data.label && 
    data.label.includes('OLT') && 
    data.ponId && 
    data.openPonSelector;

  // Simple node - just label and clickable
  if (data.nodeType === 'simple') {
    const handleClick = () => {
      console.log("Node clicked - id:", data);

      // return;
      if (data.onClick) {
        data.onClick(data.id);
      }
    };
    
    return (
      <div
        style={{ 
          padding: 10, 
          border: '1px solid black', 
          borderRadius: 5, 
          width: '150px',
          backgroundColor: data.color || '#ffffff',
          cursor: 'pointer',
          position: 'relative'
        }}
        onClick={handleClick}
      >
        <div style={{fontSize: '14px', textAlign: 'center', fontWeight: 'bold'}}>{data.label}</div>
        <Handle type="target" position="top" />
        <Handle type="source" position="bottom" />
      </div>
    );
  }

  // JCBox node
  if (data.label === 'JC Box') {
    return (
      <div
        style={{ 
          padding: 10, 
          border: '1px solid black', 
          borderRadius: 5, 
          width: '200px',
          backgroundColor: data.color || '#f39c12',
          position: 'relative'
        }}
      >
          <button
            onClick={handleDeleteClick}
            style={{
              position: 'absolute',
              top: '5px',
              right: '5px',
              backgroundColor: '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              zIndex: 10
            }}
          >
            ✕
          </button>
        
        <div style={{fontSize: '14px', fontWeight: 'bold', marginBottom: '5px'}}>{data.label}</div>
        
        <div style={{fontSize: '12px', marginBottom: '3px'}}>Input OP:</div>
        <input
          type="text"
          name="inputOp"
          value={fields.inputOp}
          onChange={handleFieldChange}
          style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px' }}
        />

        <div style={{fontSize: '12px', marginBottom: '3px'}}>OP Previous:</div>
        <input
          type="text"
          name="opPrevious"
          value={fields.opPrevious}
          onChange={handleFieldChange}
          style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px' }}
        />

        <div style={{fontSize: '12px', marginBottom: '3px'}}>OP Current:</div>
        <input
          type="text"
          name="opCurrent"
          value={fields.opCurrent}
          onChange={handleFieldChange}
          style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px' }}
        />

        <div style={{fontSize: '12px', marginBottom: '3px'}}>Distance (m):</div>
        <input
          type="text"
          name="distance"
          value={fields.distance}
          onChange={handleFieldChange}
          style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px' }}
        />

        <div style={{fontSize: '12px', marginBottom: '3px'}}>Description:</div>
        <textarea
          name="description"
          value={fields.description}
          onChange={handleFieldChange}
          style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px', minHeight: '40px' }}
        />

        <Handle type="target" position="top" />
        <Handle type="source" position="bottom" />
      </div>
    );
  }

  // Loop node
  if (data.label === 'Loop') {
    return (
      <div
        style={{ 
          padding: 10, 
          border: '1px solid black', 
          borderRadius: 5, 
          width: '200px',
          backgroundColor: data.color || '#2ecc71',
          position: 'relative'
        }}
      >
          <button
            onClick={handleDeleteClick}
            style={{
              position: 'absolute',
              top: '5px',
              right: '5px',
              backgroundColor: '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              zIndex: 10
            }}
          >
            ✕
          </button>
        
        <div style={{fontSize: '14px', fontWeight: 'bold', marginBottom: '5px'}}>{data.label}</div>
        
        <div style={{fontSize: '12px', marginBottom: '3px'}}>Distance (m):</div>
        <input
          type="text"
          name="distance"
          value={fields.distance}
          onChange={handleFieldChange}
          style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px' }}
        />

        <div style={{fontSize: '12px', marginBottom: '3px'}}>Loop:</div>
        <input
          type="text"
          name="loop"
          value={fields.loop}
          onChange={handleFieldChange}
          style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px' }}
        />

        <div style={{fontSize: '12px', marginBottom: '3px'}}>Description:</div>
        <textarea
          name="description"
          value={fields.description}
          onChange={handleFieldChange}
          style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px', minHeight: '40px' }}
        />

        <Handle type="target" position="top" />
        <Handle type="source" position="bottom" />
      </div>
    );
  }

  // Detailed node with form fields (default case)
  return (
    <div
      style={{ 
        padding: 10, 
        border: '1px solid black', 
        borderRadius: 5, 
        width: '200px',
        backgroundColor: data.color || '#f0f0f0',
        position: 'relative'
      }}
    >
      {/* {isDeletableNode && ( */}
        <button
          onClick={handleDeleteClick}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            backgroundColor: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 10
          }}
        >
          ✕
        </button>
      {/* )} */}
      
      <div style={{fontSize: '14px', fontWeight: 'bold', marginBottom: '5px'}}>{data.label}</div>
      
      {/* Add Change PON button for OLT nodes */}
      {isOltNode && (
        <div 
          className="change-pon-button"
          onClick={handleChangePonClick}
          style={{
            backgroundColor: '#3498db',
            color: 'white',
            padding: '5px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            textAlign: 'center',
            marginBottom: '8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Change PON
        </div>
      )}
      
      <div style={{fontSize: '12px', marginBottom: '3px'}}>PON OP:</div>
      <input
        type="text"
        name="ponOp"
        value={fields.ponOp}
        onChange={handleFieldChange}
        style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px' }}
      />

      <div style={{fontSize: '12px', marginBottom: '3px'}}>Device Type:</div>
      <select
        name="deviceType"
        value={fields.deviceType}
        onChange={handleDeviceTypeChange}
        style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px' }}
      >
        <option value="" disabled>Select type</option>
        <option value="Splitter">Splitter</option>
        <option value="Device">Device</option>
      </select>

      {showSplitterOptions && (
        <>
          <div style={{fontSize: '12px', marginBottom: '3px'}}>Splitter Ratio:</div>
          <select
            name="splitterType"
            value={fields.splitterType}
            onChange={handleSplitterChange}
            style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px' }}
          >
            <option value="" disabled>Select ratio</option>
            <option value="1/2">1/2</option>
            <option value="1/4">1/4</option>
            <option value="1/8">1/8</option>
            <option value="1/16">1/16</option>
          </select>
        </>
      )}

      {showDeviceOptions && (
        <>
          <div style={{fontSize: '12px', marginBottom: '3px'}}>Device:</div>
          <select
            name="deviceModel"
            value={fields.deviceModel}
            onChange={handleDeviceSelect}
            style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px' }}
          >
            <option value="" >Select device</option>
            <option value="ONU">ONU</option>
            <option value="ONT">ONT</option>
          </select>
        </>
      )}

      <div style={{fontSize: '12px', marginBottom: '3px'}}>Output OP:</div>
      <input
        type="text"
        name="outputOp"
        value={fields.outputOp}
        onChange={handleFieldChange}
        style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px' }}
      />

      <div style={{fontSize: '12px', marginBottom: '3px'}}>Current OP:</div>
      <input
        type="text"
        name="currentOp"
        value={fields.currentOp}
        onChange={handleFieldChange}
        style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px' }}
      />

      <div style={{fontSize: '12px', marginBottom: '3px'}}>Distance (m):</div>
      <input
        type="text"
        name="distance"
        value={fields.distance}
        onChange={handleFieldChange}
        style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px' }}
      />

      <div style={{fontSize: '12px', marginBottom: '3px'}}>FMS:</div>
      <input
        type="text"
        name="fms"
        value={fields.fms}
        onChange={handleFieldChange}
        style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px' }}
      />

      <div style={{fontSize: '12px', marginBottom: '3px'}}>FMS PORT:</div>
      <input
        type="text"
        name="fmsPort"
        value={fields.fmsPort}
        onChange={handleFieldChange}
        style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px' }}
      />

      <div style={{fontSize: '12px', marginBottom: '3px'}}>Description:</div>
      <textarea
        name="description"
        value={fields.description}
        onChange={handleFieldChange}
        style={{ marginBottom: '5px', width: '100%', padding: '2px', fontSize: '11px', minHeight: '40px' }}
      />

      <Handle type="target" position="top" />
      <Handle type="source" position="bottom" />
    </div>
  );
};

export default CustomNode;
