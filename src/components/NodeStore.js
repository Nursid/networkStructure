// NodeStore.js - Central store for tracking nodes outside of React state

// Create a global store to track nodes when React state might not be in sync
const NodeStore = {
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
  },
  updateNodePosition: function(id, position) {
    if (this.nodes[id]) {
      this.nodes[id].position = position;
    }
  }
};

export default NodeStore; 