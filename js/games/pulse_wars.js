

export class PulseWarsGame {
    constructor(dome, ui, particleSystem) {
        this.dome = dome;
        this.ui = ui;
        this.particleSystem = particleSystem;

        this.active = false;

        // Game State
        this.ringNodes = [];
        this.redIndex = 0;
        this.blueIndex = 0;
        this.redStart = 0;
        this.blueStart = 0;

        // Charge State { 'red': 0, 'blue': 0 } (0 to 5)
        this.charges = { 1: 0, 2: 0 };
        this.winTeam = 0;
    }

    start() {
        this.active = true;
        this.ui.updateStatus("Pulse Wars: CHARGE THE LINES!");

        // Cleanup previous state
        this.dome.nodes.forEach(n => {
            n.capturedBy = null;
            n.owner = null;
            n.pulseIntensity = 0;
            n.isTarget = false;
        });
        this.dome.edges.forEach(e => {
            e.chargeRatio = 0;
            e.chargeColor = null;
        });

        // 1. Identify Battle Ring
        let ring = this.dome.nodes.filter(n => n.p3[2] > -0.1 && n.p3[2] < 0.6);
        ring.sort((a, b) => {
            const angA = Math.atan2(a.p3[1], a.p3[0]);
            const angB = Math.atan2(b.p3[1], b.p3[0]);
            return angB - angA; // CW
        });

        this.ringNodes = ring;
        const N = ring.length;

        this.redStart = 0;
        this.blueStart = Math.floor(N / 2);

        this.redIndex = this.redStart; // Current Head
        this.blueIndex = this.blueStart; // Current Head

        this.charges = { 1: 0, 2: 0 };
        this.winTeam = 0;

        this.updateVisuals();
    }

    stop() {
        this.active = false;
        // cleanup colors and edges
        this.dome.nodes.forEach(n => {
            n.capturedBy = null;
            n.owner = null;
            n.pulseIntensity = 0;
            n.isTarget = false;
        });
        this.dome.edges.forEach(e => {
            e.chargeRatio = 0;
            e.chargeColor = null;
            e.color = null;     // Clear persistent color
            e.intensity = 0;    // Clear intensity
        });
    }

    update(dt) {
        if (!this.active) return;

        if (this.winTeam !== 0) return;

        // Pulse Current Heads
        const p = 0.5 + 0.3 * Math.sin(Date.now() / 150);

        // Red
        const redNode = this.ringNodes[this.redIndex];
        redNode.owner = 1;
        redNode.pulseIntensity = p;

        // Blue
        const blueNode = this.ringNodes[this.blueIndex];
        blueNode.owner = 2;
        blueNode.pulseIntensity = p;

        this.updateUI();
    }

    findEdge(idA, idB) {
        // Find edge between two nodes
        // Naive search in edge list (fast enough for small graph)
        // or check adj list
        // Dome edges store indices into node array? Or IDs?
        // Renderer uses dome.edges which has {a, b} as indices into dome.nodes array.
        // We know the NODES, we need their indices in the master array.

        const idxA = this.dome.nodes.indexOf(this.dome.nodes.find(n => n.id === idA));
        const idxB = this.dome.nodes.indexOf(this.dome.nodes.find(n => n.id === idB));

        return this.dome.edges.find(e =>
            (e.a === idxA && e.b === idxB) || (e.a === idxB && e.b === idxA)
        );
    }

    onInteract(node) {
        if (!this.active || this.winTeam !== 0) return;

        // Check Red Interaction (Must click Red Head)
        if (node.id === this.ringNodes[this.redIndex].id) {
            this.handleCharge(1, node);
            return;
        }

        // Check Blue Interaction (Must click Blue Head)
        if (node.id === this.ringNodes[this.blueIndex].id) {
            this.handleCharge(2, node);
            return;
        }
    }

    handleCharge(team, node) {
        // Increment charge
        this.charges[team]++;

        // Visuals
        const color = team === 1 ? '#ff0055' : '#3b82f6';
        if (this.particleSystem) {
            this.particleSystem.spawn(node.sx, node.sy, color, 3);
        }

        // Update Strut
        const currentIndex = team === 1 ? this.redIndex : this.blueIndex;
        const nextIndex = (currentIndex + 1) % this.ringNodes.length;

        const currentNode = this.ringNodes[currentIndex];
        const nextNode = this.ringNodes[nextIndex];

        const edge = this.findEdge(currentNode.id, nextNode.id);

        if (this.charges[team] >= 5) {
            // Success! Advance
            if (this.particleSystem) this.particleSystem.spawn(node.sx, node.sy, color, 20);

            // Capture next node
            this.charges[team] = 0;

            // Advance Index
            if (team === 1) this.redIndex = nextIndex;
            else this.blueIndex = nextIndex;

            // Reset edge (it stays lit or resets? "Fill it up.. gets control of it".
            // If they get control, they move to it. The strut remains "theirs" technically.
            // But for visuals let's reset the fill so they can fill the NEXT one.
            if (edge) {
                edge.chargeRatio = 0; // Reset for next
                edge.color = color;   // Keep it lit permanently for this game
                edge.intensity = 1.0;
            }

            // Check Win (Lap Condition: Reached OTHER start)
            const targetIndex = team === 1 ? this.blueStart : this.redStart;
            if ((team === 1 && this.redIndex === this.blueStart) ||
                (team === 2 && this.blueIndex === this.redStart)) {
                this.gameOver(team);
            }

        } else {
            // Update Fill
            if (edge) {
                edge.chargeRatio = this.charges[team] / 5.0;
                edge.chargeColor = color;
                edge.chargeSource = currentNode.id;
            }
        }

        this.updateVisuals();
    }

    updateVisuals() {
        if (this.winTeam !== 0) return;

        // Render captured territory
        // Red
        let r = this.redStart;
        while (r !== this.redIndex) {
            this.ringNodes[r].capturedBy = 1;
            r = (r + 1) % this.ringNodes.length;
        }
        this.ringNodes[this.redIndex].capturedBy = 1; // Head is ours

        // Blue
        let b = this.blueStart;
        while (b !== this.blueIndex) {
            this.ringNodes[b].capturedBy = 2;
            b = (b + 1) % this.ringNodes.length;
        }
        this.ringNodes[this.blueIndex].capturedBy = 2;
    }

    updateUI() {
        this.ui.updateScore({
            label: "Frontline",
            p1: `${this.redIndex}`,
            p2: `${this.blueIndex}`
        });
    }

    gameOver(team) {
        this.winTeam = team;
        const winnerName = team === 1 ? "RED" : "BLUE";
        const color = team === 1 ? '#ff0055' : '#3b82f6';

        this.ui.showNotification(`${winnerName} TEAM WINS!`, team === 1 ? "error" : "info");

        // Eat Animation
        // Iterate BACKWARDS from loser's head to winner's tail?
        // Or just ripple fill the whole ring with winner color.

        let i = 0;
        const interval = setInterval(() => {
            if (i >= this.ringNodes.length) {
                clearInterval(interval);

                // Final Flash
                setTimeout(() => {
                    this.dome.nodes.forEach(n => {
                        n.capturedBy = team; // Turn everything winner color
                        n.pulseIntensity = 1;
                    });
                }, 500);

                // Restart
                setTimeout(() => this.start(), 3000);
                return;
            }

            // Fill ring CW
            const idx = (this.redStart + i) % this.ringNodes.length; // Start from Red's visual start for consistency?
            this.ringNodes[idx].capturedBy = team;
            this.ringNodes[idx].pulseIntensity = 1;
            this.particleSystem.spawn(this.ringNodes[idx].sx, this.ringNodes[idx].sy, color, 5);

            i++;
        }, 50);

        // Flash EVERYTHING at end
        setTimeout(() => {
            clearInterval(interval); // ensuring
            this.dome.nodes.forEach(n => {
                n.capturedBy = team;
                n.pulseIntensity = 1;
            });
            this.dome.edges.forEach(e => {
                e.color = color;
                e.intensity = 1.0;
            });
        }, 1500); // Trigger flash earlier? User said "flash the winning colour".

        // After flash, reset
        setTimeout(() => {
            this.stop(); // Ensure full cleanup
            this.start(); // Restart
        }, 4000);
    }
}
