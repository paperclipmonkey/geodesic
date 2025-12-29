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
    
    // Config
    this.ledsPerEdge = LEDS_PER_EDGE;
    
    this.build();
  }

  // Vector Math Helpers
  vecAdd(a, b) { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
  vecScale(a, s) { return [a[0]*s, a[1]*s, a[2]*s]; }
  vecLen(a) { return Math.hypot(a[0], a[1], a[2]); }
  vecNorm(a) {
    const l = this.vecLen(a) || 1;
    return [a[0]/l, a[1]/l, a[2]/l];
  }
  midpoint(a, b) { return this.vecScale(this.vecAdd(a, b), 0.5); }

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
        ringCharge: 0     // 0 to 12
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

    this.edges.push({
      a: aLine, 
      b: bLine, 
      leds: new Uint8Array(this.ledsPerEdge).fill(0), // Brightness/Color packed? simplified to brightness for now or index
      // For simulation, we might store color per LED later. 
      // For now, let's keep the existing logic: edges light up as a whole or gradients.
      // To support full addressability, we'll imagine each edge has 'LEDS_PER_EDGE' pixels.
      pixelData: new Float32Array(this.ledsPerEdge * 3) // RGB per pixel
    });
  }

  build() {
    const t = (1 + Math.sqrt(5)) / 2;
    const baseVerts = [
      [-1, t, 0],[1, t, 0],[-1,-t,0],[1,-t,0],
      [0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],
      [t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]
    ].map(v => this.vecNorm(v));

    const faces = [
      [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
      [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
      [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
      [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]
    ];

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
        [0,3],[3,5],[5,0], // Top triangle
        [3,1],[1,4],[4,3], // Middle right
        [5,4],[4,2],[2,5]  // Middle left
      ];

      connections.forEach(([a, b]) => this.addEdge(ids[a], ids[b]));
    });
    
    console.log(`Dome Built: ${this.nodes.length} nodes, ${this.edges.length} edges`);
  }
}
