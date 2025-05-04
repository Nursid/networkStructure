import dagre from '@dagrejs/dagre';

// Constants for node dimensions
export const nodeWidth = 200;
export const nodeHeight = 150;

// Create layout function that can be used by any component
export const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  // Create a new graph
  const graphUtils = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  
  // Configure graph settings
  graphUtils.setGraph({ 
    rankdir: direction, 
    ranksep: 400,      // Increased vertical separation
    nodesep: 200,      // Increased horizontal separation
    edgesep: 150,      // Edge separation
    marginx: 50,       // Margin x
    marginy: 50,       // Margin y
    acyclicer: 'greedy', // Handle cycles if any
    ranker: 'network-simplex' // Use network simplex algorithm for ranking
  });

  // Add nodes to the graph
  nodes.forEach((node) => {
    // Special handling for JCBox and Loop nodes - slightly smaller size for aesthetics
    let width = nodeWidth;
    let height = nodeHeight;
    
    if (node.data.label === 'JC Box' || node.data.label === 'Loop') {
      width = nodeWidth * 0.9;
      height = nodeHeight * 0.9;
    }
    
    graphUtils.setNode(node.id, { 
      width: width, 
      height: height,
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