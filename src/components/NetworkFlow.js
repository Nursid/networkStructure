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
  useReactFlow
} from '@xyflow/react';
import { Button } from 'reactstrap';
import '@xyflow/react/dist/style.css';
import './NetworkStyles.css';

// Import components
import DebugPanel from './DebugPanel';
import NodeStore from './NodeStore';
import { getLayoutedElements, } from './NetworkLayout';
import { 
  createPonClickHandler, 
  createSplitterHandler, 
  createDeviceHandler,
  deleteNodeHandler,
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
  const [rfInstance, setRfInstance] = useState(null);
  // Use useRef for idCounter to maintain consistent reference
  const idCounterRef = useRef(1);
  
  // Debug state to show current state
  const [debugInfo, setDebugInfo] = useState({});
  // State to track selected node for deletion
  // const [selectedNode, setSelectedNode] = useState(null);
  
  // State for context menu
  const [contextMenu, setContextMenu] = useState(null);
  // State for PON selector
  const [ponSelector, setPonSelector] = useState(null);

  // React Flow state
  const [initialNodes, setInitialNodes] = useState([]);
  const [initialEdges, setInitialEdges] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { setViewport } = useReactFlow();
  
  // Custom node change handler to update NodeStore when nodes are moved
  const handleNodesChange = useCallback((changes) => {
    // Apply the changes to the nodes state first
    onNodesChange(changes);
    
    // Update NodeStore with new positions for dragged nodes
    changes.forEach(change => {
      if (change.type === 'position' && change.dragging === false) {
        // Node dragging has completed - update NodeStore
        const node = nodes.find(n => n.id === change.id);
        if (node) {
          NodeStore.updateNodePosition(change.id, change.position);
        }
      }
    });
  }, [nodes, onNodesChange]);
  
  // Suppress ResizeObserver loop warning
  useEffect(() => {
    // Save the original console error function
    const originalConsoleError = console.error;
    
    // Override console.error to suppress specific ResizeObserver warning
    console.error = (...args) => {
      if (args[0]?.includes?.('ResizeObserver loop') || 
          args[0]?.message?.includes?.('ResizeObserver loop') ||
          (typeof args[0] === 'string' && args[0].includes('ResizeObserver loop'))) {
        // Don't log the ResizeObserver warning
        return;
      }
      // Log all other errors normally
      originalConsoleError(...args);
    };
    
    // Cleanup function to restore original console.error when component unmounts
    return () => {
      console.error = originalConsoleError;
    };
  }, []);
  
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
      // Ensure we're updating ponId correctly for rewiring operations
      if (updatedData.ponId) {
        console.log(`Updating node ${id} with new ponId: ${updatedData.ponId}`);
      }
      node.data = { ...node.data, ...updatedData };
    } else {
      console.warn(`Node ${id} not found in store during update`);
    }
    
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          // Create a new data object with the updated properties
          const updatedNodeData = { ...node.data, ...updatedData };
          return { ...node, data: updatedNodeData };
        }
        return node;
      })
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
    
    // Find all edges where this node is the target (incoming edges)
    const incomingEdges = edges.filter(e => e.target === nodeId);
    
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

    // Update all child nodes recursively to ensure they reference the same PON
    const updateChildNodes = (parentId, ponId, ponNumber) => {
      // Find all edges where this parent is the source
      const childEdges = edges.filter(e => e.source === parentId);
      
      // For each child, update its ponId and label
      childEdges.forEach(edge => {
        const childId = edge.target;
        const childNode = nodes.find(n => n.id === childId);
        
        if (childNode) {
          // Update child node ponId
          onNodeUpdate(childId, { ponId: ponId });
          
          // Update child node label
          if (childNode.data.label && childNode.data.label.includes('PON')) {
            const ponRegex = /PON \d+/;
            const newChildLabel = childNode.data.label.replace(ponRegex, `PON ${ponNumber}`);
            onNodeUpdate(childId, { label: newChildLabel });
          }
          
          // Recursively update children of this child
          updateChildNodes(childId, ponId, ponNumber);
        }
      });
    };
    
    // Start the recursive update from the rewired node
    updateChildNodes(nodeId, newPonId, newPonNumber);
    
    // Remove all incoming edges and add the new one
    setEdges(eds => {
      // Keep all edges that don't have this node as a target
      const filteredEdges = eds.filter(e => !incomingEdges.some(ie => ie.id === e.id));
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
      (node.data.label.includes('PON') && !node.data.label.includes('EPON'))
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
      // Use a ref to track if we're already calculating layout
      const layoutTimeoutRef = { current: null };
      
      // Clear any existing timeout
      if (layoutTimeoutRef.current) {
        clearTimeout(layoutTimeoutRef.current);
      }
      
      // Debounce layout calculations to reduce ResizeObserver calls
      layoutTimeoutRef.current = setTimeout(() => {
        applyLayout();
        layoutTimeoutRef.current = null;
      }, 300); // Wait for 300ms of inactivity before recalculating layout
      
      // Clear timeout on cleanup
      return () => {
        if (layoutTimeoutRef.current) {
          clearTimeout(layoutTimeoutRef.current);
        }
      };
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
    
    // Only proceed if we have nodes and edges
    if (nodesCopy.length === 0 || edgesCopy.length === 0) {
      return;
    }
    
    try {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodesCopy, 
        edgesCopy
      );
      
      // Batch state updates by requesting animation frame
      // This helps prevent multiple sequential DOM updates that trigger ResizeObserver
      window.requestAnimationFrame(() => {
        setNodes(layoutedNodes);
      });
    } catch (error) {
      console.warn("Layout calculation error:", error);
    }
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
            // onClick: handlePonNodeClick(node.id),
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
    
    // Find the node and current PON details for better logging
    const nodeToMove = nodes.find(n => n.id === ponSelector.nodeId);
    const currentPonNode = nodes.find(n => n.id === ponSelector.currentPonId);
    const newPonNode = nodes.find(n => n.id === newPonId);
    
    // Get labels for user-friendly notification
    const nodeLabel = nodeToMove?.data?.label || 'Unknown node';
    const fromPonLabel = currentPonNode?.data?.label || 'Unknown PON';
    const toPonLabel = newPonNode?.data?.label || 'Unknown PON';
    
    console.log(`Moving ${nodeLabel} from ${fromPonLabel} to ${toPonLabel}`);
    
    // Rewire the node to the new PON
    handleRewirePon(ponSelector.nodeId, newPonId);
    
    // Close the PON selector
    setPonSelector(null);
    
    // Add a temporary notification (optional)
    const notificationDiv = document.createElement('div');
    notificationDiv.style.position = 'fixed';
    notificationDiv.style.top = '20px';
    notificationDiv.style.left = '50%';
    notificationDiv.style.transform = 'translateX(-50%)';
    notificationDiv.style.backgroundColor = 'rgba(46, 204, 113, 0.9)';
    notificationDiv.style.color = 'white';
    notificationDiv.style.padding = '10px 20px';
    notificationDiv.style.borderRadius = '5px';
    notificationDiv.style.zIndex = '1000';
    notificationDiv.style.fontSize = '14px';
    notificationDiv.textContent = `Successfully moved ${nodeLabel} to ${toPonLabel}`;
    document.body.appendChild(notificationDiv);
    
    // Remove the notification after 3 seconds
    setTimeout(() => {
      document.body.removeChild(notificationDiv);
    }, 3000);
    
  }, [ponSelector, handleRewirePon, nodes]);

  // Close menus when clicking elsewhere
  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    setPonSelector(null);
  }, []);

  const flowKey = 'example-flow';


  const onSave = useCallback(() => {
    if (rfInstance) {
      // Get the current flow state with all positions
      const flow = rfInstance.toObject();
      
      // Ensure nodes in the flow have correct positions from NodeStore
      flow.nodes = flow.nodes.map(node => {
        const storedNode = NodeStore.getNode(node.id);
        if (storedNode && storedNode.position) {
          return {
            ...node,
            position: storedNode.position,
            data: {
                ...node.data,
                onClick: () => handlePonNodeClick(node.id)
            }
          };
        }
        return node;
      });
      // Save to localStorage
      localStorage.setItem(flowKey, JSON.stringify(flow));
      console.log("Flow saved with node positions");
    }
  }, [rfInstance]);
 
  const onRestore = useCallback(() => {
    const restoreFlow = async () => {
      const flow = JSON.parse(localStorage.getItem(flowKey));
 
      if (flow) {
        const { x = 0, y = 0, zoom = 1 } = flow.viewport;
        
        // Reattach callback functions to nodes before setting them
        const restoredNodes = flow.nodes.map(node => {
          // Create a new node with the same data but reattach callbacks
          return {
            ...node,
            data: {
              ...node.data,
              onUpdate: (updatedData) => onNodeUpdate(node.id, updatedData),
              onSplitterSelect: (event, _, numChildren, splitterType) => {
                console.log("Splitter callback with restored ID:", node.id);
                handleSplitterSelect(event, node.id, numChildren, splitterType, node.data.ponId);
              },
              onClick: () => handlePonNodeClick(node.id),
              onDeviceSelect: (event, _, deviceType) => {
                console.log("Device callback with restored ID:", node.id);
                handleDeviceSelect(event, node.id, deviceType);
              },
              openPonSelector: node.data.ponId ? (e, nodeId, x, y) => {
                // Get all available PON nodes
                const ponNodes = nodes.filter(n => 
                  n.data.label && (n.data.label.includes('PON') || n.data.label.includes('EPON'))
                );
                
                setPonSelector({
                  nodeId,
                  x,
                  y,
                  currentPonId: node.data.ponId,
                  ponOptions: ponNodes.map(pon => ({
                    id: pon.id,
                    label: pon.data.label
                  }))
                });
              } : undefined,
              onDelete: isDeletableNode(node) ? () => handleDeleteNode(node.id) : undefined,
             
            }
          };
        });
        
        // Update NodeStore with restored nodes
        restoredNodes.forEach(node => {
          NodeStore.addNode(node);
        });
        
        setNodes(restoredNodes);
        setEdges(flow.edges || []);
        setViewport({ x, y, zoom });
        
        // Log state after restoration
        setTimeout(() => {
          logState('Restored Flow');
        }, 100);
      }
    };
 
    restoreFlow();
  }, [setNodes, setViewport, handleSplitterSelect, handleDeviceSelect, onNodeUpdate, handleDeleteNode, nodes]);

  // Helper function to determine if a node is deletable
  const isDeletableNode = (node) => {
    return node.data.label && 
      !node.data.label.includes('PON') && 
      !node.data.label.includes('EPON');
  };

  return (
    <div style={{ height: '100vh', width: '100%', backgroundColor: '#f5f5f5' }}>
      <Panel position="top-center">
        <Button color="primary" onClick={resetFlow} style={{ marginRight: '10px' }}>
          Reset Network Flow
        </Button>
        <Button color="success" onClick={onSave}>
          Save
        </Button>
        <Button color="success" onClick={onRestore}>
          Restore
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
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.2, includeHiddenNodes: false }}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.2}
        maxZoom={2}
        onInit={setRfInstance}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
      >
        <Background variant="dots" gap={12} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default NetworkFlow; 