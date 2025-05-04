import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  ConnectionLineType,
  Panel,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import { Button } from 'reactstrap';
import '@xyflow/react/dist/style.css';

// Import components
import DebugPanel from './DebugPanel';
import NodeStore from './NodeStore';
import { getLayoutedElements, nodeWidth, nodeHeight } from './NetworkLayout';
import { 
  createPonClickHandler, 
  createSplitterHandler, 
  createDeviceHandler,
  getNextStepId 
} from './NodeHandlers';
import CustomNode from '../CustomNode';

// Main NetworkFlow component wrapped with ReactFlowProvider
const NetworkFlow = () => {
  return (
    <ReactFlowProvider>
      <FlowContent />
    </ReactFlowProvider>
  );
};

// The main content of the flow component
const FlowContent = () => {
  const nodeTypes = useMemo(() => ({ CustomNode: CustomNode }), []);
  // Use useRef for idCounter to maintain consistent reference
  const idCounterRef = useRef(1);
  
  // Debug state to show current state
  const [debugInfo, setDebugInfo] = useState({});

  // React Flow state
  const [initialNodes, setInitialNodes] = useState([]);
  const [initialEdges, setInitialEdges] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Debugging helper
  const logState = (action) => {
    console.log(`[${action}] Nodes:`, nodes);
    console.log(`[${action}] Edges:`, edges);
    console.log(`[${action}] Node store:`, NodeStore.getAllNodes());
    setDebugInfo({
      action,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      storeCount: NodeStore.getAllNodes().length,
      timestamp: new Date().toISOString()
    });
  };

  // Define onNodeUpdate first - before using it in handler functions
  const onNodeUpdate = useCallback((id, updatedData) => {
    if (!id) {
      console.error("Cannot update node: id is undefined");
      return;
    }
    
    // Also update in store
    const node = NodeStore.getNode(id);
    if (node) {
      node.data = { ...node.data, ...updatedData };
    }
    
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...updatedData } }
          : node
      )
    );
  }, []);

  // Now define handlers that use onNodeUpdate
  const handleDeviceSelect = createDeviceHandler(
    NodeStore, 
    onNodeUpdate, 
    idCounterRef,
    nodes,
    setNodes,
    setEdges,
    logState
  );
  
  const handleSplitterSelect = createSplitterHandler(
    NodeStore,
    nodes,
    setNodes,
    setEdges,
    onNodeUpdate,
    idCounterRef,
    logState
  );

  const handlePonNodeClick = (ponId) => {
    createPonClickHandler(
      ponId,
      idCounterRef,
      NodeStore,
      nodes,
      setNodes,
      setEdges,
      onNodeUpdate,
      handleSplitterSelect,
      handleDeviceSelect,
      logState
    );
  };

  // Set up initial EPON and PON nodes when component mounts
  useEffect(() => {
    setupInitialNodes();
  }, []);

  // Keep nodeStore in sync with nodes state
  useEffect(() => {
    // Clear the store first
    NodeStore.clear();
    
    // Add all current nodes to the store
    nodes.forEach(node => {
      NodeStore.addNode(node);
    });
    
    console.log("Node store updated:", NodeStore.getAllNodes().length, "nodes");
  }, [nodes]);

  // Apply layout and update the flow when nodes or edges change
  useEffect(() => {
    if (nodes.length > 0 && edges.length > 0) {
      applyLayout();
    }
  }, [nodes.length, edges.length]);

  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(
          { ...params, type: ConnectionLineType.SmoothStep, animated: true },
          eds,
        ),
      ),
    [],
  );

  const applyLayout = () => {
    // Create a separate copy of nodes and edges to avoid state mutation issues
    const nodesCopy = [...nodes];
    const edgesCopy = [...edges];
    
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodesCopy, 
      edgesCopy
    );
    
    // Use a timeout to ensure state updates don't conflict
    setTimeout(() => {
      setNodes(layoutedNodes);
    }, 10);
  };

  const setupInitialNodes = () => {
    // Reset counter and store
    idCounterRef.current = 1;
    NodeStore.clear();
    
    const eponNode = {
      id: 'epon-1',
      type: 'CustomNode',
      data: { 
        label: 'EPON', 
        nodeType: 'simple',
        color: '#e74c3c',
        id: 'epon-1'
      },
      position: { x: 0, y: 0 }
    };
    
    // Add to nodeStore
    NodeStore.addNode(eponNode);

    const ponNodes = [];
    const ponEdges = [];

    // Create 8 PON nodes
    for (let i = 1; i <= 8; i++) {
      const ponId = `pon-${i}`;
      const ponNode = {
        id: ponId,
        type: 'CustomNode',
        data: { 
          label: `PON ${i}`, 
          nodeType: 'simple',
          color: '#3498db',
          onClick: (id) => handlePonNodeClick(id),
          id: ponId
        },
        position: { x: 0, y: 0 } // Position will be calculated by dagre
      };

      ponNodes.push(ponNode);
      // Add to nodeStore
      NodeStore.addNode(ponNode);

      // Connect EPON to each PON
      const edge = {
        id: `e-epon-1-pon-${i}`,
        source: 'epon-1',
        target: ponId,
        type: 'smoothstep',
        animated: true
      };

      ponEdges.push(edge);
    }

    const allNodes = [eponNode, ...ponNodes];
    const allEdges = [...ponEdges];

    setInitialNodes(allNodes);
    setInitialEdges(allEdges);
    
    // Apply layout and set nodes/edges
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      allNodes,
      allEdges
    );
    
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
    // Log initial state
    setTimeout(() => {
      logState('Initial Setup');
    }, 100);
  };

  const resetFlow = () => {
    idCounterRef.current = 1;
    setupInitialNodes();
  };

  return (
    <div style={{ height: '100vh', width: '100%', backgroundColor: '#f5f5f5' }}>
      <Panel position="top-center">
        <Button color="primary" onClick={resetFlow} style={{ marginRight: '10px' }}>
          Reset Network Flow
        </Button>
      </Panel>
      
      {/* Debug panel */}
      <DebugPanel debugInfo={debugInfo} />
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        nodeTypes={nodeTypes}
      >
        <Background variant="dots" gap={12} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default NetworkFlow; 