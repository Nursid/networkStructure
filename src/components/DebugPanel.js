import React from 'react';
import { Panel } from '@xyflow/react';

const DebugPanel = ({ debugInfo }) => {
  return (
    <Panel position="top-right" style={{ background: '#f8f9fa', padding: '10px', border: '1px solid #ddd' }}>
      <div style={{ fontSize: '12px' }}>
        <div>Nodes (React): {debugInfo.nodeCount}</div>
        <div>Nodes (Store): {debugInfo.storeCount}</div>
        <div>Edges: {debugInfo.edgeCount}</div>
        <div>Last Action: {debugInfo.action}</div>
      </div>
    </Panel>
  );
};

export default DebugPanel; 