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

// Import custom styles for edge interactivity
import './NetworkStyles.css';

// Import components
import DebugPanel from './DebugPanel';
import NodeStore from './NodeStore';
import { getLayoutedElements, nodeWidth, nodeHeight } from './NetworkLayout';
import { 
  createPonClickHandler, 
  createSplitterHandler, 
  createDeviceHandler,
  deleteNodeHandler,
  getNextStepId,
  createNodeOnEdge
} from './NodeHandlers';
import CustomNode from '../CustomNode';
import EdgeContextMenu from './EdgeContextMenu';
import PonSelector from './PonSelector';

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
  // State to track selected node for deletion
  const [selectedNode, setSelectedNode] = useState(null);
  
  // State for context menu
  const [contextMenu, setContextMenu] = useState(null);
  // State for PON selector
  const [ponSelector, setPonSelector] = useState(null);

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

  // Handle node deletion
  const handleDeleteNode = useCallback((nodeId) => {
    console.log("Deleting node:", nodeId);
    deleteNodeHandler(
      nodeId,
      NodeStore,
      nodes,
      edges,
      setNodes,
      setEdges,
      logState
    );
  }, [nodes, edges]);

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

  // Handle PON rewiring
  const handleRewirePon = useCallback((nodeId, newPonId) => {
    // Get the node to rewire
    const nodeToRewire = nodes.find(n => n.id === nodeId);
    if (!nodeToRewire || !nodeToRewire.data.ponId) {
      console.error("Cannot find node to rewire or node does not have ponId");
      return;
    }

    const currentPonId = nodeToRewire.data.ponId;
    
    // Don't do anything if the PON isn't changing
    if (currentPonId === newPonId) {
      console.log("Same PON selected, no changes needed");
      return;
    }
    
    console.log(`Rewiring node ${nodeId} from PON ${currentPonId} to PON ${newPonId}`);
    
    // Find the edge connecting the node to its current PON
    const oldEdge = edges.find(e => 
      e.source === currentPonId && e.target === nodeId
    );
    
    if (!oldEdge) {
      console.error("Cannot find edge connecting node to current PON");
      return;
    }
    
    // Create a new edge from the new PON to the node
    const newEdge = {
      id: `e-${newPonId}-${nodeId}`,
      source: newPonId,
      target: nodeId,
      type: 'smoothstep',
      animated: true
    };
    
    // Update the node's ponId reference
    onNodeUpdate(nodeId, { ponId: newPonId });
    
    // Update the label to reflect the new PON connection
    const oldLabel = nodeToRewire.data.label;
    let newLabel = oldLabel;
    
    // Extract PON number from the new PON ID
    let newPonNumber;
    if (typeof newPonId === 'string' && newPonId.includes('-')) {
      newPonNumber = newPonId.split('-')[1];
    } else {
      const newPonNode = nodes.find(n => n.id === newPonId);
      const match = newPonNode?.data?.label?.match(/PON (\d+)/);
      newPonNumber = match ? match[1] : 'unknown';
    }
    
    // Update the label to reflect the new PON
    if (oldLabel.includes('PON')) {
      const ponRegex = /PON \d+/;
      newLabel = oldLabel.replace(ponRegex, `PON ${newPonNumber}`);
      onNodeUpdate(nodeId, { label: newLabel });
    }
    
    // Remove the old edge and add the new one
    setEdges(eds => {
      const filteredEdges = eds.filter(e => e.id !== oldEdge.id);
      return [...filteredEdges, newEdge];
    });
    
    // Log state after update
    setTimeout(() => {
      logState('Rewired Node to New PON');
    }, 100);
    
  }, [nodes, edges, onNodeUpdate]);

  // Function to open the PON selector
  const openPonSelector = useCallback((event, nodeId, clientX, clientY) => {
    // Prevent event propagation
    event.stopPropagation();
    
    // Get all available PON nodes
    const ponNodes = nodes.filter(node => 
      node.data.label && 
      node.data.label.includes('PON') && 
      !node.data.label.includes('EPON')
    );
    
    // Get the current PON ID from the node
    const nodeToRewire = nodes.find(n => n.id === nodeId);
    const currentPonId = nodeToRewire?.data?.ponId;
    
    if (!currentPonId) {
      console.error("Cannot find current PON ID for node");
      return;
    }
    
    // Format the PON options
    const ponOptions = ponNodes.map(ponNode => ({
      id: ponNode.id,
      label: ponNode.data.label
    }));
    
    // Set the PON selector state
    setPonSelector({
      x: clientX,
      y: clientY,
      nodeId,
      currentPonId,
      ponOptions
    });
  }, [nodes]);

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
    
    // console.log("Node store updated:", NodeStore.getAllNodes().length, "nodes");
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

  // Find all nodes that can be deleted (all nodes except PON and EPON nodes)
  const getDeletableNodes = () => {
    return nodes.filter(node => 
      (node.data.label && 
       !node.data.label.includes('PON') && 
       !node.data.label.includes('EPON')
      )
    );
  };

  // Find all nodes that are OLT nodes (have OLT in their label)
  const getOltNodes = () => {
    return nodes.filter(node => 
      node.data.label && 
      node.data.label.includes('OLT') &&
      node.data.ponId // Must have a ponId to be rewirable
    );
  };

  // Process nodes to include onDelete callback and openPonSelector
  useEffect(() => {
    setNodes(nds => 
      nds.map(node => {
        // Check if this is an OLT node (has OLT in label and a ponId)
        const isOltNode = node.data?.label?.includes('OLT') && node.data?.ponId;
        
        return {
          ...node,
          data: {
            ...node.data,
            onDelete: handleDeleteNode,
            // Only add the openPonSelector callback to OLT nodes
            ...(isOltNode && { openPonSelector })
          }
        };
      })
    );
  }, [handleDeleteNode, openPonSelector]);

  // Handle edge click to open context menu
  const onEdgeClick = useCallback((event, edge) => {
    // Prevent event propagation
    event.stopPropagation();
    
    // Find the source and target nodes to calculate better positions
    const sourceNode = nodes.find(node => node.id === edge.source);
    const targetNode = nodes.find(node => node.id === edge.target);
    
    if (!sourceNode || !targetNode) {
      console.error("Source or target node not found for edge", edge);
      return;
    }
    
    // Calculate a position along the edge based on the mouse click
    // This will be adjusted later when actually creating the node
    const clickPosition = {
      x: event.clientX,
      y: event.clientY
    };
    
    // Set context menu position
    setContextMenu({
      x: clickPosition.x,
      y: clickPosition.y,
      edgeId: edge.id,
      sourceId: edge.source,
      targetId: edge.target,
      sourcePosition: sourceNode.position,
      targetPosition: targetNode.position,
      // Store the flow-relative coordinates for actual node placement
      nodePosition: {
        x: (sourceNode.position.x + targetNode.position.x) / 2,
        y: (sourceNode.position.y + targetNode.position.y) / 2
      }
    });
  }, [nodes]);

  // Handle context menu item selection
  const handleContextMenuSelect = useCallback((nodeType) => {
    if (!contextMenu) return;
    
    // Create new node on edge
    createNodeOnEdge(
      nodeType,
      contextMenu.edgeId,
      contextMenu.sourceId,
      contextMenu.targetId,
      contextMenu.nodePosition,
      idCounterRef,
      NodeStore,
      nodes,
      edges,
      setNodes,
      setEdges,
      onNodeUpdate,
      logState
    );
    
    // Close context menu
    setContextMenu(null);
  }, [contextMenu, nodes, edges, onNodeUpdate]);

  // Handle PON selector selection
  const handlePonSelectorSelect = useCallback((newPonId) => {
    if (!ponSelector) return;
    
    // Rewire the node to the new PON
    handleRewirePon(ponSelector.nodeId, newPonId);
    
    // Close the PON selector
    setPonSelector(null);
  }, [ponSelector, handleRewirePon]);

  // Close menus when clicking elsewhere
  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    setPonSelector(null);
  }, []);

  return (
    <div style={{ height: '100vh', width: '100%', backgroundColor: '#f5f5f5' }}>
      <Panel position="top-center">
        <Button color="primary" onClick={resetFlow} style={{ marginRight: '10px' }}>
          Reset Network Flow
        </Button>
      </Panel>
      
      {/* Delete Nodes Button in top-right */}
      <Panel position="top-right">
        <Button 
          color="danger" 
          style={{ margin: '10px' }}
          onClick={() => {
            const deletableNodes = getDeletableNodes();
            if (deletableNodes.length > 0) {
              // Show notification that nodes can be deleted using the delete button on each node
              alert("Click the 'Delete' button on any node you want to remove (except PON and EPON nodes which cannot be deleted).");
            } else {
              alert("No nodes available to delete.");
            }
          }}
        >
          Delete Nodes
        </Button>
      </Panel>
      
      {/* Edge interaction tooltip */}
      <Panel position="bottom-center" style={{ marginBottom: '20px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '8px 12px', borderRadius: '5px' }}>
        <div style={{ fontSize: '13px' }}>
          <span role="img" aria-label="tip">💡</span> Tip: Click on any edge to add JCBox or Loop nodes
        </div>
      </Panel>
      
      {/* PON rewiring tooltip */}
      <Panel position="bottom-left" style={{ marginBottom: '20px', marginLeft: '20px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '8px 12px', borderRadius: '5px' }}>
        <div style={{ fontSize: '13px' }}>
          <span role="img" aria-label="tip">💡</span> Tip: Use the "Change PON" button on OLT nodes to rewire them
        </div>
      </Panel>
      
      {/* Debug panel */}
      <DebugPanel debugInfo={debugInfo} />
      
      {/* Context menu for edge click */}
      {contextMenu && (
        <EdgeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onSelect={handleContextMenuSelect}
          onClose={() => setContextMenu(null)}
        />
      )}
      
      {/* PON selector for rewiring */}
      {ponSelector && (
        <PonSelector
          x={ponSelector.x}
          y={ponSelector.y}
          ponOptions={ponSelector.ponOptions}
          currentPonId={ponSelector.currentPonId}
          onSelect={handlePonSelectorSelect}
          onClose={() => setPonSelector(null)}
        />
      )}
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
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