
export class SnakeGame {
    constructor(dome, ui, particleSystem) {
        this.dome = dome;
        this.ui = ui;
        this.particleSystem = particleSystem;
        this.active = false;

        // Snake State
        this.speed = 0.5; // Meters per second (Slower movement)
        this.head = null; // { edge: object, t: 0..1, direction: 1/-1 }
        this.tail = null; // { edge: object, t: 0..1, direction: 1/-1 }
        this.bodyEdges = []; // List of edges fully occupied between head/tail

        this.currentLength = 0;
        this.targetLength = 0;

        // Navigation State
        // Map nodeId -> index in dome.adj[nodeId]
        this.nodeDecisions = new Map();

        // Game State
        this.score = 0;
        this.targetNode = null;
        this.isFlashing = false;
        this.flashTimer = 0;

        // Config
        this.baseColor = { r: 0, g: 255, b: 157 };
        this.flashColor = { r: 255, g: 0, b: 0 };
    }

    start() {
        this.active = true;
        this.score = 0;
        this.currentLength = 0;

        // Initialize Directions Randomly
        this.dome.nodes.forEach(n => {
            const neighbors = this.dome.adj[n.id];
            if (neighbors && neighbors.length > 0) {
                this.nodeDecisions.set(n.id, Math.floor(Math.random() * neighbors.length));
            }
        });

        // Initialize Snake on a random edge
        const startEdge = this.dome.edges[Math.floor(Math.random() * this.dome.edges.length)];
        // Start 1/3rd of a strut long
        const startLen = startEdge.length / 3;
        this.targetLength = startLen;
        this.currentLength = startLen;

        // Head at 0.5, moving towards B (direction 1); Tail at 0.5 - (len/edgeLen)
        // Actually simpler: Center it.
        const halfLen = startLen / 2;
        const midT = 0.5;
        const lenT = startLen / startEdge.length;

        this.head = {
            edge: startEdge,
            t: midT + lenT / 2,
            direction: 1 // Moving towards node B
        };

        this.tail = {
            edge: startEdge,
            t: midT - lenT / 2,
            direction: 1
        };

        this.bodyEdges = []; // Empty since head and tail on same edge

        this.spawnTarget();
        this.ui.updateStatus("Interactive Snake: Press nodes to switch tracks!");
        this.ui.updateScore({ label: "Length", p1: this.score });
    }

    stop() {
        this.active = false;
        // Clean up visual state
        this.dome.nodes.forEach(n => {
            n.color = null;
            n.isTarget = false;
            n.pulseIntensity = 0;
            // Clear visualization of direction
            n.ringCharge = 0;
            if (n.leds) n.leds.fill(0);
        });
        this.dome.edges.forEach(e => {
            e.color = null;
            e.intensity = 0;
            if (e.pixelData) e.pixelData.fill(0);
        });
    }

    spawnTarget() {
        // Find a node well away from the snake head
        let potential;
        let attempts = 0;
        const maxAttempts = 50;

        // For distance checks
        const headPos = this.getHeadPosition();

        do {
            const idx = Math.floor(Math.random() * this.dome.nodes.length);
            potential = this.dome.nodes[idx];
            attempts++;

            // Simple check: don't spawn on the node immediate towards head
            // Better check would be distance
            if (this.dome.dist(headPos, potential.p3) > 1.0) {
                break;
            }
        } while (attempts < maxAttempts);

        if (this.targetNode) this.targetNode.isTarget = false;
        this.targetNode = potential;
        this.targetNode.isTarget = true;
    }

    getHeadPosition() {
        const h = this.head;
        const nA = this.dome.nodes[h.edge.a];
        const nB = this.dome.nodes[h.edge.b];
        // Lerp
        const x = nA.p3[0] + (nB.p3[0] - nA.p3[0]) * h.t;
        const y = nA.p3[1] + (nB.p3[1] - nA.p3[1]) * h.t;
        const z = nA.p3[2] + (nB.p3[2] - nA.p3[2]) * h.t;
        return [x, y, z];
    }

    onInteract(node) {
        if (!this.active) return;

        // Cycle the decision index for this node
        const neighbors = this.dome.adj[node.id];
        if (!neighbors || neighbors.length === 0) return;

        let currentIdx = this.nodeDecisions.get(node.id) || 0;
        currentIdx = (currentIdx + 1) % neighbors.length;
        this.nodeDecisions.set(node.id, currentIdx);

        // Visual Feedback: Pulse the node white briefly
        node.pulseIntensity = 1.0;

        // Also light up the start of the newly selected edge
        const nextNodeId = neighbors[currentIdx];
        const edge = this.dome.getEdge(node.id, nextNodeId);
        if (edge) {
            // Momentary flash on the edge to show selection
            // We'll handle persistent direction visualization in update()
        }
    }

    update(dt) {
        if (!this.active) return;

        if (this.isFlashing) {
            this.flashTimer -= dt;
            if (this.flashTimer <= 0) this.isFlashing = false;
        }

        // 1. Move Head
        this.moveHead(dt);

        // 2. Move Tail (maintain length)
        this.moveTail(dt);

        // 3. Render
        this.updateVisuals(dt);
    }

    moveHead(dt) {
        const dist = this.speed * dt;
        // Increase t based on direction
        // scale dist by edge length
        let step = dist / this.head.edge.length;

        this.head.t += step * this.head.direction;
        this.currentLength += dist; // Temporarily grow, tail will retract

        // Check boundary
        let nodeReached = null;
        if (this.head.direction === 1 && this.head.t >= 1.0) {
            nodeReached = this.dome.nodes[this.head.edge.b];
        } else if (this.head.direction === -1 && this.head.t <= 0.0) {
            nodeReached = this.dome.nodes[this.head.edge.a];
        }

        if (nodeReached) {
            // Check for Reward
            if (nodeReached === this.targetNode) {
                this.consumeReward();
            }

            // Transit to next edge
            this.pushHeadToNextEdge(nodeReached);
        }
    }

    consumeReward() {
        this.score++;
        this.ui.updateScore({ label: "Score", p1: this.score });

        // Grow by 1/3rd of a strut (approx 0.5m)
        this.targetLength += 0.5; // Meters

        this.spawnTarget();
    }

    pushHeadToNextEdge(node) {
        // Find next edge from Node Decisions
        const neighbors = this.dome.adj[node.id];
        const decisionIdx = this.nodeDecisions.get(node.id) || 0;
        const nextNodeId = neighbors[decisionIdx];
        const nextEdge = this.dome.getEdge(node.id, nextNodeId);

        if (nextEdge === this.head.edge) {
            // BOUNCE / REVERSE
            this.reverseSnake();
            return;
        }

        // Enqueue current edge to body
        this.bodyEdges.push({
            edge: this.head.edge,
            direction: this.head.direction
        });

        // Determine direction on new edge
        // If node is A of nextEdge, we move A->B (dir 1).
        // If node is B of nextEdge, we move B->A (dir -1).
        const newDir = (nextEdge.a === node.id) ? 1 : -1;

        this.head = {
            edge: nextEdge,
            t: (newDir === 1) ? 0.0 : 1.0,
            direction: newDir
        };
    }

    reverseSnake() {
        // Swap Head and Tail movement logic
        const oldHead = this.head;
        const oldTail = this.tail;

        // 1. Convert Old Tail to New Head
        // Tail was "receding" from t. Head "advances" from t.
        this.head = {
            edge: oldTail.edge,
            t: oldTail.t,
            direction: -oldTail.direction
        };

        // 2. Convert Old Head to New Tail
        this.tail = {
            edge: oldHead.edge,
            t: oldHead.t,
            direction: -oldHead.direction
        };

        // 3. Reverse Body Edges
        this.bodyEdges.reverse();
        // Flip direction of each segment because traversal order flipped
        this.bodyEdges.forEach(seg => {
            seg.direction *= -1;
        });

        // Visual Feedback
        this.ui.showNotification("Reverse!", "info");
    }

    moveTail(dt) {
        // If we are longer than target length, shrink tail
        if (this.currentLength > this.targetLength) {
            const dist = this.speed * dt; // Retract at same speed
            const diff = this.currentLength - this.targetLength;

            // Cap retraction speed so we don't snap
            const moveDist = Math.max(0, Math.min(dist, diff));

            let step = moveDist / this.tail.edge.length;
            this.tail.t += step * this.tail.direction;
            this.currentLength -= moveDist;

            // Check boundary
            let finishedEdge = false;
            if (this.tail.direction === 1 && this.tail.t >= 1.0) {
                finishedEdge = true;
            } else if (this.tail.direction === -1 && this.tail.t <= 0.0) {
                finishedEdge = true;
            }

            if (finishedEdge) {
                // Tail moves to next edge in bodyEdges
                if (this.bodyEdges.length > 0) {
                    const nextSegment = this.bodyEdges.shift();
                    this.tail.edge = nextSegment.edge;
                    this.tail.direction = nextSegment.direction;
                    this.tail.t = (this.tail.direction === 1) ? 0.0 : 1.0;
                } else {
                    // Should not happen if length > 0, head runs away
                    // But if head and tail are on same edge and tail crosses, it means we are catching up to head
                    // Ideally head jumps to new edge before tail finishes current edge
                }
            }
        }
    }

    updateVisuals(dt) {
        // 1. Clear all edges
        this.dome.edges.forEach(e => {
            if (e.pixelData) e.pixelData.fill(0);
        });

        // 2. Draw Snake
        const col = this.isFlashing ? this.flashColor : this.baseColor;

        // Helper to paint pixels
        const paint = (edge, tStart, tEnd) => {
            if (!edge.pixelData) return;
            const len = edge.ledCount;
            // t goes 0->1
            const iStart = Math.floor(Math.min(tStart, tEnd) * len);
            const iEnd = Math.ceil(Math.max(tStart, tEnd) * len);

            // Check for collision (if pixels already set)
            // But we need to distinguish "already set by this frame drawing" vs "overlap"
            // Since we cleared, any overlap is self-collision

            for (let i = iStart; i < iEnd; i++) {
                if (i >= 0 && i < len) {
                    const idx = i * 3;
                    if (edge.pixelData[idx] > 0 || edge.pixelData[idx + 1] > 0) {
                        // Collision detected!
                        this.triggerCollision();
                    }
                    edge.pixelData[idx] = col.r;
                    edge.pixelData[idx + 1] = col.g;
                    edge.pixelData[idx + 2] = col.b;
                }
            }
        };

        // Draw Full Body Edges
        this.bodyEdges.forEach(seg => {
            paint(seg.edge, 0.0, 1.0);
        });

        // Draw Head Segment
        // From start to t
        if (this.head.direction === 1) {
            paint(this.head.edge, 0.0, this.head.t);
        } else {
            paint(this.head.edge, 1.0, this.head.t);
        }

        // Draw Tail Segment
        // Note: Tail is 'chasing'. If tail is on same edge as head, we need to handle that.
        // If bodyEdges is empty, head and tail are on same edge.
        if (this.bodyEdges.length === 0 && this.head.edge === this.tail.edge) {
            // Reset pixelData for this edge first to avoid false collision
            this.head.edge.pixelData.fill(0);

            let t1 = this.tail.t;
            let t2 = this.head.t;
            paint(this.head.edge, t1, t2);
        } else {
            // Tail is on its own edge.
            // It occupies from t to End (moving away from t)
            // Wait. Tail moves along trace.
            // If tail dir is 1 (A->B), it has cleared 0..t. So it occupies t..1.
            if (this.tail.direction === 1) {
                paint(this.tail.edge, this.tail.t, 1.0);
            } else {
                paint(this.tail.edge, this.tail.t, 0.0);
            }
        }

        // 3. Draw Decisions (Direction Indicators) on Nodes
        this.dome.nodes.forEach(n => {
            // Default reset
            n.color = null;
            n.pulseIntensity = 0;
            // Clear LED Ring
            if (n.leds) n.leds.fill(0);

            if (n.isTarget) {
                n.color = "rgb(255, 255, 255)";
                n.pulseIntensity = 0.8 + 0.2 * Math.sin(performance.now() / 100);
            } else {
                // Direction Indicator
                const decisionIdx = this.nodeDecisions.get(n.id);
                if (decisionIdx !== undefined) {
                    const neighbors = this.dome.adj[n.id];
                    const nextId = neighbors[decisionIdx];

                    // 1. Point with Node LEDs (Ring)
                    // We need screen coordinates to determine angle
                    const neighbor = this.dome.nodes[nextId];
                    if (n.sx !== undefined && neighbor.sx !== undefined) {
                        const dx = neighbor.sx - n.sx;
                        const dy = neighbor.sy - n.sy;
                        const angle = Math.atan2(dy, dx);

                        // Map angle to LED index (0..11)
                        // Renderer starts 0 at -PI/2 (Top) and goes CW
                        // angle is standard math (0 at Right, CW positive in screen coords)

                        // angle = (i / 12) * 2PI - PI/2
                        // i = (angle + PI/2) / 2PI * 12
                        let normalized = angle + Math.PI / 2;
                        if (normalized < 0) normalized += Math.PI * 2;

                        const ledIdx = Math.round(normalized / (Math.PI * 2) * 12) % 12;

                        // Light up 3 LEDs (center + neighbors) for visibility
                        const setLed = (idx, c) => {
                            const ii = (idx + 12) % 12;
                            n.leds[ii * 3] = c[0];
                            n.leds[ii * 3 + 1] = c[1];
                            n.leds[ii * 3 + 2] = c[2];
                        };

                        setLed(ledIdx, [100, 100, 100]); // Center bright
                        setLed(ledIdx - 1, [40, 40, 40]);
                        setLed(ledIdx + 1, [40, 40, 40]);
                    }

                    // 2. Guide Light on Strut
                    const edge = this.dome.getEdge(n.id, nextId);
                    if (edge && edge.pixelData) {
                        const isA = (edge.a === n.id);
                        // Light up first 3 pixels
                        for (let k = 0; k < 3; k++) {
                            const pIdx = isA ? k * 3 : (edge.ledCount - 1 - k) * 3;
                            if (pIdx >= 0 && pIdx < edge.pixelData.length) {
                                // Only if not snake
                                if (edge.pixelData[pIdx] === 0) {
                                    const fade = 1 - (k / 3);
                                    const val = Math.floor(100 * fade);
                                    edge.pixelData[pIdx] = val;
                                    edge.pixelData[pIdx + 1] = val;
                                    edge.pixelData[pIdx + 2] = val;
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    triggerCollision() {
        if (!this.isFlashing) {
            this.isFlashing = true;
            this.flashTimer = 0.5; // Flash for 500ms
        }
    }
}
