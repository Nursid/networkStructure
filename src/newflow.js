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
import dagre from '@dagrejs/dagre';
import CustomNode from './CustomNode';
import { Button } from 'reactstrap';
import '@xyflow/react/dist/style.css';
 
const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
 
const nodeWidth = 200;
const nodeHeight = 150;
 
// Create a global store to track nodes when React state might not be in sync
const nodeStore = {
  nodes: {},
  addNode: function(node) {
    this.nodes[node.id] = node;
  },
  getNode: function(id) {
    return this.nodes[id];
  },
  removeNode: function(id) {
    delete this.nodes[id];
  },
  getAllNodes: function() {
    return Object.values(this.nodes);
  },
  clear: function() {
    this.nodes = {};
  }
};
 
// Wrap Flow in ReactFlowProvider
const NetworkFlow = () => {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
};
 
const Flow = () => {
  const nodeTypes = useMemo(() => ({ CustomNode: CustomNode }), []);
  // Use useRef for idCounter to maintain consistent reference
  const idCounterRef = useRef(1);
  
  // Debug state to show current state
  const [debugInfo, setDebugInfo] = useState({});

  // Initial EPON node and PON nodes
  const [initialNodes, setInitialNodes] = useState([]);
  const [initialEdges, setInitialEdges] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Set up initial EPON and PON nodes when component mounts
  useEffect(() => {
    setupInitialNodes();
  }, []);

  // Keep nodeStore in sync with nodes state
  useEffect(() => {
    // Clear the store first
    nodeStore.clear();
    
    // Add all current nodes to the store
    nodes.forEach(node => {
      nodeStore.addNode(node);
    });
    
    console.log("Node store updated:", nodeStore.getAllNodes().length, "nodes");
  }, [nodes]);

  // Apply layout and update the flow when nodes or edges change
  useEffect(() => {
    if (nodes.length > 0 && edges.length > 0) {
      applyLayout();
    }
  }, [nodes.length, edges.length]);
  
  // Debugging helper
  const logState = (action) => {
    console.log(`[${action}] Nodes:`, nodes);
    console.log(`[${action}] Edges:`, edges);
    console.log(`[${action}] Node store:`, nodeStore.getAllNodes());
    setDebugInfo({
      action,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      storeCount: nodeStore.getAllNodes().length,
      timestamp: new Date().toISOString()
    });
  };

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
    nodeStore.clear();
    
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
    nodeStore.addNode(eponNode);

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
      nodeStore.addNode(ponNode);

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

  const getLayoutedElements = (nodes, edges, direction = 'TB') => {
    // Create a new graph
    const graphUtils = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    
    // Configure graph settings
    graphUtils.setGraph({ 
      rankdir: direction, 
      ranksep: 400,      // Increased vertical separation even more
      nodesep: 200,      // Increased horizontal separation
      edgesep: 150,      // Edge separation
      marginx: 50,       // Margin x
      marginy: 50,       // Margin y
      acyclicer: 'greedy', // Handle cycles if any
      ranker: 'network-simplex' // Use network simplex algorithm for ranking
    });

    // Add nodes to the graph
    nodes.forEach((node) => {
      graphUtils.setNode(node.id, { 
        width: nodeWidth, 
        height: nodeHeight,
        label: node.data.label // Add label for debugging
      });
    });

    // Add edges to the graph
    edges.forEach((edge) => {
      if (edge.source && edge.target) {
        graphUtils.setEdge(edge.source, edge.target);
      }
    });

    try {
      // Run the layout algorithm
      dagre.layout(graphUtils);
      
      // Apply the calculated positions to the nodes
      const newNodes = nodes.map((node) => {
        const nodeWithPosition = graphUtils.node(node.id);
        
        // Skip if dagre doesn't have position info (may happen during updates)
        if (!nodeWithPosition) {
          return node;
        }
        
        // Apply dagre position while preserving other properties
        return {
          ...node,
          // Set source/target positions based on direction
          targetPosition: 'top',
          sourcePosition: 'bottom',
          position: {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2
          }
        };
      });

      return { nodes: newNodes, edges };
    } catch (error) {
      console.error('Error in layout calculation:', error);
      return { nodes, edges };
    }
  };

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

  const getNextStepId = () => {
    const id = `node-${idCounterRef.current}`;
    idCounterRef.current += 1;
    return id;
  };

  // Handle PON node click
  const handlePonNodeClick = (ponId) => {
    console.log("handlePonNodeClick called with:", ponId);
    
    // Guard against undefined ponId
    if (!ponId) {
      console.error("ponId is undefined");
      return;
    }
    
    let ponNumber;
    
    // Check if ponId is a string and has the expected format
    if (typeof ponId === 'string' && ponId.includes('-')) {
      ponNumber = ponId.split('-')[1];
    } else {
      // Fallback - try to find the node and get its label
      const node = nodeStore.getNode(ponId) || nodes.find(n => n.id === ponId);
      if (node && node.data && node.data.label) {
        const match = node.data.label.match(/PON (\d+)/);
        if (match) {
          ponNumber = match[1];
        } else {
          console.error("Could not extract PON number from label");
          ponNumber = "unknown";
        }
      } else {
        console.error("Could not find node with id:", ponId);
        ponNumber = "unknown";
      }
    }
    
    const newStepId = getNextStepId();
    console.log("Created node with ID:", newStepId);
    
    // Find the parent node to get its position
    const parentNode = nodeStore.getNode(ponId) || nodes.find(n => n.id === ponId);
    const parentY = parentNode?.position?.y || 0;
    
    // Create the Step 1 OLT node
    const newNode = {
      id: newStepId,
      type: 'CustomNode',
      data: { 
        label: `Step 1 - OLT-99 PON ${ponNumber}`,
        ponId: ponId, // Store original PON ID for reference
        onUpdate: (updatedData) => onNodeUpdate(newStepId, updatedData),
        // Use a closure to capture the correct node ID
        onSplitterSelect: (event, _, numChildren, splitterType) => {
          console.log("Splitter callback with captured ID:", newStepId);
          handleSplitterSelect(event, newStepId, numChildren, splitterType, ponId);
        },
        onDeviceSelect: (event, _, deviceType) => {
          console.log("Device callback with captured ID:", newStepId);
          handleDeviceSelect(event, newStepId, deviceType);
        },
        id: newStepId // Explicitly store ID in data as well
      },
      // Position with increased vertical spacing
      position: { x: 0, y: parentY + 350 },
      targetPosition: 'top',
      sourcePosition: 'bottom'
    };
    
    // Add to nodeStore immediately
    nodeStore.addNode(newNode);

    // Create edge from PON to Step 1
    const newEdge = {
      id: `e-${ponId}-${newStepId}`,
      source: ponId,
      target: newStepId,
      type: 'smoothstep',
      animated: true
    };

    // Add the new node and edge using a function to ensure state is properly updated
    setNodes((nds) => {
      const updatedNodes = [...nds, newNode];
      console.log("Updated nodes array:", updatedNodes.length);
      return updatedNodes;
    });
    
    setEdges((eds) => [...eds, newEdge]);
    
    // Log state after update
    setTimeout(() => {
      logState('Added OLT Node');
    }, 100);
  };

  // Handle Splitter selection
  const handleSplitterSelect = (event, parentId, numChildren, splitterType, originalPonId) => {
    console.log("handleSplitterSelect called with parentId:", parentId);
    console.log("Current React nodes array:", nodes.length);
    console.log("Current nodes in store:", nodeStore.getAllNodes().length);
    
    // Guard against undefined parentId
    if (!parentId) {
      console.error("parentId is undefined");
      return;
    }
    
    // Look for the parent node in both the nodes state and nodeStore
    let parentNode = nodeStore.getNode(parentId);
    
    // If not found in store, try the state
    if (!parentNode) {
      parentNode = nodes.find(node => node.id === parentId);
    }
    
    if (!parentNode) {
      console.error("Parent node not found:", parentId);
      console.log("Available node IDs in store:", Object.keys(nodeStore.nodes));
      console.log("Available node IDs in state:", nodes.map(n => n.id));
      return;
    }
    
    console.log("Found parent node:", parentNode);
    
    const parentLabel = parentNode?.data?.label || '';
    
    // Get PON ID either from the passed parameter or from parent node data
    const ponId = originalPonId || parentNode?.data?.ponId;
    
    // Determine step number from parent node label
    let stepNumber = 1;
    if (parentLabel.includes('Step')) {
      const match = parentLabel.match(/Step (\d+)/);
      if (match) {
        stepNumber = parseInt(match[1]) + 1;
      }
    }

    // Get PON number from parent node label
    let ponPart = '';
    const ponMatch = parentLabel.match(/PON (\d+)/);
    if (ponMatch) {
      ponPart = `PON ${ponMatch[1]}`;
    }

    // Create child nodes based on splitter type
    const letters = 'abcdefghijklmnop'; // For labeling nodes a through p
    
    // Calculate initial positions based on parent position
    const parentX = parentNode.position ? parentNode.position.x : 0;
    const parentY = parentNode.position ? parentNode.position.y : 0;
    const parentWidth = parentNode.width || nodeWidth;

    const newNodes = [];
    const newEdges = [];

    for (let i = 0; i < numChildren; i++) {
      const newId = getNextStepId();
      console.log("Created child node with ID:", newId);
      const letterLabel = letters[i];
      
      // Calculate horizontal position for node spreading
      const spreadFactor = numChildren <= 1 ? 0 : (i / (numChildren - 1) - 0.5) * 2;
      const xOffset = spreadFactor * parentWidth * numChildren;

            const newNode = {
        id: newId,
        type: 'CustomNode',
        data: { 
          label: `Step ${stepNumber}(${letterLabel}) - OLT-99 ${ponPart}`,
          ponId: ponId, // Store original PON ID for reference
          onUpdate: (updatedData) => onNodeUpdate(newId, updatedData),
          // Use a closure to capture the correct node ID
          onSplitterSelect: (event, _, numChildren, splitterType) => {
            console.log("Splitter callback with captured ID:", newId);
            handleSplitterSelect(event, newId, numChildren, splitterType, ponId);
          },
          onDeviceSelect: (event, _, deviceType) => {
            console.log("Device callback with captured ID:", newId);
            handleDeviceSelect(event, newId, deviceType);
          },
          id: newId // Explicitly store ID in data as well
        },
        // Initial position below parent with spread
        position: { 
          x: parentX + xOffset, 
          y: parentY + 350
        },
        targetPosition: 'top',
        sourcePosition: 'bottom'
      };
      
      // Add to nodeStore immediately
      nodeStore.addNode(newNode);
            newNodes.push(newNode);

      // Create edge from parent to this node
      const parentEdge = {
        id: `e-${parentId}-${newId}`,
                source: parentId,
        target: newId,
                type: 'smoothstep',
        animated: true
      };
      
      newEdges.push(parentEdge);
    }

    // Add new nodes and edges one by one to ensure they're all processed
    setNodes(prevNodes => {
      console.log("Setting nodes, current count:", prevNodes.length);
      return [...prevNodes, ...newNodes];
    });
    
    setEdges(prevEdges => [...prevEdges, ...newEdges]);
    
    // Update parent node data
    onNodeUpdate(parentId, { splitterType: splitterType });
    
    // Log state after update
    setTimeout(() => {
      logState('Added Splitter Children');
    }, 100);
  };

  // Handle Device selection
  const handleDeviceSelect = (event, parentId, deviceType) => {
    console.log("handleDeviceSelect called with parentId:", parentId);
    
    if (!parentId) {
      console.error("parentId is undefined");
      return;
    }
    
    // Update parent node data with the selected device type
    onNodeUpdate(parentId, { deviceModel: deviceType });
  };

  // Update node data
  const onNodeUpdate = useCallback((id, updatedData) => {
    if (!id) {
      console.error("Cannot update node: id is undefined");
      return;
    }
    
    console.log("Updating node:", id, "with data:", updatedData);
    
    // Also update in store
    const node = nodeStore.getNode(id);
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
      <Panel position="top-right" style={{ background: '#f8f9fa', padding: '10px', border: '1px solid #ddd' }}>
        <div style={{ fontSize: '12px' }}>
          <div>Nodes (React): {debugInfo.nodeCount}</div>
          <div>Nodes (Store): {debugInfo.storeCount}</div>
          <div>Edges: {debugInfo.edgeCount}</div>
          <div>Last Action: {debugInfo.action}</div>
        </div>
      </Panel>
      
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