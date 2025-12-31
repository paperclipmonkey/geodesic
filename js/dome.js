/**
 * Geodesic Dome Geometry Engine
 * Handles generation of the 2V Icosahedron structure (hemisphere)
 * and maintains the state of nodes and edges.
 */

const LEDS_PER_EDGE = 24;

export class Dome {
  constructor() {
    this.nodes = [];
    this.edges = [];
    this.faces = [];
    this.vertMap = new Map();
    this.adj = []; // Adjacency list for graph traversal

    // Config
    this.ledsPerEdge = LEDS_PER_EDGE; // Default/Fallback
    this.radius = 2.5; // Meters
    this.ledSpacing = 0.02; // Meters (20mm)

    this.build();
    this.assignOwnership();
  }

  // ... (Vector Math Helpers remain the same) ...
  vecAdd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  vecScale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  vecLen(a) { return Math.hypot(a[0], a[1], a[2]); }
  vecNorm(a) {
    const l = this.vecLen(a) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }
  midpoint(a, b) { return this.vecScale(this.vecAdd(a, b), 0.5); }
  dist(a, b) { return this.vecLen([a[0] - b[0], a[1] - b[1], a[2] - b[2]]); }

  quant(v) { return v.map(x => x.toFixed(5)).join(","); }

  addVert(vUnit) {
    // Hemisphere cut: ignore vertices below horizon (z < -0.01 for tolerance)
    if (vUnit[2] < -0.01) return null;

    const key = this.quant(vUnit);
    if (!this.vertMap.has(key)) {
      const id = this.nodes.length;
      const node = {
        id,
        p3: vUnit,       // 3D Unit Position [x,y,z]
        sx: 0, sy: 0,    // Screen coordinates (updated by Renderer)

        // Game State Properties
        pressedBy: new Set(),
        owner: null,
        pulseIntensity: 0,

        // Pulse Wars Specific
        capturedBy: null, // 1=Red, 2=Blue
        chargeTeam: null,
        ringCharge: 0,    // 0 to 12
        color: null,      // Custom color override

        // RS485 Control
        drivenEdges: []   // List of edge indices this node controls
      };
      this.nodes.push(node);
      this.vertMap.set(key, id);
    }
    return this.vertMap.get(key);
  }

  addEdge(aLine, bLine) {
    if (aLine === null || bLine === null) return;
    if (aLine === bLine) return;

    // Check for duplicate edge
    const exists = this.edges.some(e =>
      (e.a === aLine && e.b === bLine) || (e.a === bLine && e.b === aLine)
    );
    if (exists) return;

    // Calculate Physical Properties
    const nA = this.nodes[aLine];
    const nB = this.nodes[bLine];
    const lenUnits = this.dist(nA.p3, nB.p3); // Length in unit sphere
    const lenMeters = lenUnits * this.radius;
    const count = Math.floor(lenMeters / this.ledSpacing);

    this.edges.push({
      a: aLine,
      b: bLine,
      length: lenMeters,
      leds: new Uint8Array(count).fill(0),
      pixelData: new Float32Array(count * 3), // RGB per pixel
      ledCount: count,
      color: null,
      intensity: 0,

      // RS485 Properties
      driverId: null,      // Node ID driving this strut
      chargeSource: null,  // Start node for animation direction
      chargeRatio: 0
    });

    // Update Adjacency
    if (!this.adj[aLine]) this.adj[aLine] = [];
    if (!this.adj[bLine]) this.adj[bLine] = [];
    this.adj[aLine].push(bLine);
    this.adj[bLine].push(aLine);
  }

  assignOwnership() {
    // Simple greedy assignment for RS485 simulation
    // Each node can drive up to 6 struts (typical hub max)

    const MAX_PORT = 6;

    this.edges.forEach((edge, edgeIdx) => {
      const nA = this.nodes[edge.a];
      const nB = this.nodes[edge.b];

      // Try to assign to A
      if (nA.drivenEdges.length < MAX_PORT) {
        nA.drivenEdges.push(edgeIdx);
        edge.driverId = edge.a;
      }
      // Else assign to B
      else if (nB.drivenEdges.length < MAX_PORT) {
        nB.drivenEdges.push(edgeIdx);
        edge.driverId = edge.b;
      }
      // Assignment failure (shouldn't happen in standard 2V)
      else {
        console.warn(`Edge ${edgeIdx} could not be assigned a driver!`);
      }
    });

    console.log("Ownership Assigned. Nodes driving edges:",
      this.nodes.map(n => `${n.id}:${n.drivenEdges.length}`).join(", ")
    );
  }

  build() {
    // Vertex-Zenith Aligned Icosahedron logic
    // This alignment ensures that we have a ring of vertices at Z=0 (after subdivision)
    // capable of forming a flat base for the hemisphere.

    const sqrt5 = Math.sqrt(5);
    const zRing = 1 / sqrt5;
    const rRing = 2 / sqrt5;
    const PI = Math.PI;

    const baseVerts = [];

    // 0: Top Vertex
    baseVerts.push([0, 0, 1]);

    // 1-5: Ring A (Upper Ring)
    for (let i = 0; i < 5; i++) {
      const theta = (72 * i) * (PI / 180);
      baseVerts.push([rRing * Math.cos(theta), rRing * Math.sin(theta), zRing]);
    }

    // 6-10: Ring B (Lower Ring)
    // Offset by 36 degrees
    for (let i = 0; i < 5; i++) {
      const theta = (72 * i + 36) * (PI / 180);
      baseVerts.push([rRing * Math.cos(theta), rRing * Math.sin(theta), -zRing]);
    }

    // 11: Bottom Vertex
    baseVerts.push([0, 0, -1]);

    // Faces
    const faces = [];

    // Top Cap
    for (let i = 1; i <= 5; i++) {
      const next = (i % 5) + 1;
      faces.push([0, i, next]);
    }

    // Mid Band
    for (let i = 0; i < 5; i++) {
      const a1 = i + 1;
      const a2 = ((i + 1) % 5) + 1;
      const b1 = i + 6;
      const b2 = ((i + 1) % 5) + 6;

      // Two triangles per segment
      faces.push([a1, b1, a2]);
      faces.push([b1, b2, a2]);
    }

    // Bottom Cap (needed for complete math, though we cut it later)
    for (let i = 0; i < 5; i++) {
      const b1 = i + 6;
      const b2 = ((i + 1) % 5) + 6;
      faces.push([11, b2, b1]);
    }

    faces.forEach(f => {
      const v0 = baseVerts[f[0]];
      const v1 = baseVerts[f[1]];
      const v2 = baseVerts[f[2]];

      const m01 = this.vecNorm(this.midpoint(v0, v1));
      const m12 = this.vecNorm(this.midpoint(v1, v2));
      const m20 = this.vecNorm(this.midpoint(v2, v0));

      const verts = [v0, v1, v2, m01, m12, m20];
      const ids = verts.map(v => this.addVert(v));

      // 2V tessellation connections
      const connections = [
        [0, 3], [3, 5], [5, 0], // Top triangle
        [3, 1], [1, 4], [4, 3], // Middle right
        [5, 4], [4, 2], [2, 5]  // Middle left
      ];

      connections.forEach(([a, b]) => this.addEdge(ids[a], ids[b]));
    });

    console.log(`Dome Built: ${this.nodes.length} nodes, ${this.edges.length} edges`);
  }

  findPath(startId, endId) {
    if (startId === endId) return [this.nodes[startId]];

    const queue = [startId];
    const visited = new Set([startId]);
    const parent = new Map();

    while (queue.length > 0) {
      const curr = queue.shift();
      if (curr === endId) break;

      const neighbors = this.adj[curr] || [];
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          parent.set(n, curr);
          queue.push(n);
        }
      }
    }

    if (!parent.has(endId)) return null; // No path

    // Reconstruct
    const path = [];
    let curr = endId;
    while (curr !== undefined) {
      path.unshift(this.nodes[curr]);
      curr = parent.get(curr);
    }
    return path;
  }
}
