// Handlers for node actions - creating nodes, handling events, etc.

export const createPonClickHandler = (
  ponId, 
  idCounterRef, 
  nodeStore, 
  nodes, 
  setNodes, 
  setEdges,
  onNodeUpdate,
  handleSplitterSelect,
  handleDeviceSelect,
  logState
) => {
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
  
  const newStepId = getNextStepId(idCounterRef);
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

  // Add the new node and edge
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

export const createSplitterHandler = (
  nodeStore,
  nodes, 
  setNodes, 
  setEdges,
  onNodeUpdate,
  idCounterRef,
  logState
) => {
  return (event, parentId, numChildren, splitterType, originalPonId) => {
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
    const parentWidth = parentNode.width || 200; // Use default width if not specified
    
    const newNodes = [];
    const newEdges = [];
    
    for (let i = 0; i < numChildren; i++) {
      const newId = getNextStepId(idCounterRef);
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
            const handler = createSplitterHandler(
              nodeStore, nodes, setNodes, setEdges, onNodeUpdate, idCounterRef, logState
            );
            handler(event, newId, numChildren, splitterType, ponId);
          },
          onDeviceSelect: (event, _, deviceType) => {
            console.log("Device callback with captured ID:", newId);
            createDeviceHandler(nodeStore, onNodeUpdate, idCounterRef, nodes, setNodes, setEdges, logState)(event, newId, deviceType);
          },
          id: newId // Explicitly store ID in data as well
        },
        // Initial position below parent with increased vertical spacing
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
};

export const createDeviceHandler = (
  nodeStore, 
  onNodeUpdate, 
  idCounterRef, 
  nodes, 
  setNodes, 
  setEdges,
  logState
) => {
  return (event, parentId, deviceType) => {
    console.log("handleDeviceSelect called with parentId:", parentId, "deviceType:", deviceType);
    
    if (!parentId) {
      console.error("parentId is undefined");
      return;
    }
    
    // Update parent node data with the selected device type
    onNodeUpdate(parentId, { deviceModel: deviceType });
    
    // Find the parent node
    const parentNode = nodeStore.getNode(parentId) || nodes.find(node => node.id === parentId);
    if (!parentNode) {
      console.error("Parent node not found:", parentId);
      return;
    }
    
    // Get information from parent node
    const parentLabel = parentNode.data.label || '';
    const ponId = parentNode.data.ponId;
    const parentY = parentNode.position?.y || 0;
    const parentX = parentNode.position?.x || 0;
    
    // Extract step and pon info from parent label
    let stepInfo = "";
    let ponInfo = "";
    
    const stepMatch = parentLabel.match(/Step (\d+)(?:\([a-z]\))?/);
    if (stepMatch) {
      stepInfo = stepMatch[0];
    }
    
    const ponMatch = parentLabel.match(/PON (\d+)/);
    if (ponMatch) {
      ponInfo = `PON ${ponMatch[1]}`;
    }
    
    // Generate a unique ID for the new device node
    const newDeviceId = getNextStepId(idCounterRef);
    
    // Create new device node (ONU or ONT)
    const newDeviceNode = {
      id: newDeviceId,
      type: 'CustomNode',
      data: {
        label: `${deviceType} - ${stepInfo} ${ponInfo}`,
        ponId: ponId,
        nodeType: 'device',  // Add nodeType to identify this as a device node
        deviceType: deviceType,
        id: newDeviceId,
        // Add device-specific color based on type
        color: deviceType === 'ONU' ? '#27ae60' : '#8e44ad', // Green for ONU, Purple for ONT
        onUpdate: (updatedData) => onNodeUpdate(newDeviceId, updatedData)
      },
      position: {
        x: parentX,
        y: parentY + 350
      },
      targetPosition: 'top',
      sourcePosition: 'bottom'
    };
    
    // Add to nodeStore immediately
    nodeStore.addNode(newDeviceNode);
    
    // Create edge from parent to device
    const newEdge = {
      id: `e-${parentId}-${newDeviceId}`,
      source: parentId,
      target: newDeviceId,
      type: 'smoothstep',
      animated: true
    };
    
    // Add the new node and edge
    setNodes((nds) => {
      const updatedNodes = [...nds, newDeviceNode];
      console.log("Updated nodes array after adding device:", updatedNodes.length);
      return updatedNodes;
    });
    
    setEdges((eds) => [...eds, newEdge]);
    
    // Log state after update
    setTimeout(() => {
      logState(`Added ${deviceType} Node`);
    }, 100);
  };
};

export const deleteNodeHandler = (
  nodeId,
  nodeStore,
  nodes,
  edges,
  setNodes,
  setEdges,
  logState
) => {
  if (!nodeId) {
    console.error("Cannot delete node: nodeId is undefined");
    return;
  }

  // Check if the node exists
  const nodeToDelete = nodeStore.getNode(nodeId);
  if (!nodeToDelete) {
    console.error("Node not found for deletion:", nodeId);
    return;
  }

  // Get all child nodes and edges to delete recursively
  const getAllDescendants = (nodeId) => {
    const descendants = [];
    const edgesToNode = edges.filter(edge => edge.source === nodeId);
    
    // For each edge, add the target node and its descendants
    for (const edge of edgesToNode) {
      const childId = edge.target;
      descendants.push(childId);
      descendants.push(...getAllDescendants(childId));
    }
    
    return descendants;
  };

  // Get all descendant nodes
  const descendantIds = getAllDescendants(nodeId);
  const allNodesToDelete = [nodeId, ...descendantIds];
  
  // Get all edges connected to these nodes
  const edgesToDelete = edges.filter(
    edge => allNodesToDelete.includes(edge.source) || allNodesToDelete.includes(edge.target)
  );
  
  // Remove from NodeStore
  allNodesToDelete.forEach(id => nodeStore.removeNode(id));
  
  // Update React state
  setNodes(nodes => nodes.filter(node => !allNodesToDelete.includes(node.id)));
  setEdges(edges => edges.filter(edge => 
    !edgesToDelete.includes(edge) &&
    !allNodesToDelete.includes(edge.source) && 
    !allNodesToDelete.includes(edge.target)
  ));
  
  // Log state after deletion
  setTimeout(() => {
    logState('Deleted Node and Descendants');
  }, 100);
};

export const getNextStepId = (idCounterRef) => {
  const id = `node-${idCounterRef.current}`;
  idCounterRef.current += 1;
  return id;
}; 