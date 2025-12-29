export class PulseWarsGame {
    constructor(dome, ui) {
        this.dome = dome;
        this.ui = ui;
        this.active = false;
        this.redScore = 0;
        this.blueScore = 0;
    }

    start() {
        this.active = true;
        this.reset();
        this.ui.updateStatus("Pulse Wars: Capture majority!");
    }

    stop() {
        this.active = false;
        this.dome.nodes.forEach(n => {
            n.capturedBy = null;
            n.ringCharge = 0;
            n.pulseIntensity = 0;
        });
    }

    reset() {
        // Find poles for starting bases
        // Sort nodes by X
        const sorted = [...this.dome.nodes].sort((a, b) => a.p3[0] - b.p3[0]);

        this.redScore = 0;
        this.blueScore = 0;

        // Leftmost = Red
        sorted[0].capturedBy = 1;
        sorted[1].capturedBy = 1;

        // Rightmost = Blue
        sorted[sorted.length - 1].capturedBy = 2;
        sorted[sorted.length - 2].capturedBy = 2;

        this.dome.nodes.forEach(n => n.ringCharge = 0);
    }

    update(dt) {
        if (!this.active) return;

        // Calculate scores
        let r = 0, b = 0;
        this.dome.nodes.forEach(n => {
            if (n.capturedBy === 1) r++;
            if (n.capturedBy === 2) b++;

            // Decay charge if not actively tapped recently (handled by interaction really)
            // or simple logic: if charge > 0 and not full, decay
            if (n.ringCharge > 0 && n.ringCharge < 12) {
                n.ringCharge -= dt * 5; // Decay
                if (n.ringCharge < 0) n.ringCharge = 0;
            }
        });

        this.redScore = r;
        this.blueScore = b;

        this.ui.updateScore({
            p1: this.redScore,
            p2: this.blueScore,
            label: "Territory"
        });
    }

    onInteract(node) {
        if (!this.active) return;

        // Logic: Can only capture if adjacent to own territory
        const neighbors = this.getNeighbors(node);

        // Check adjacency
        const adjRed = neighbors.some(n => n.capturedBy === 1);
        const adjBlue = neighbors.some(n => n.capturedBy === 2);

        // Assume local player identity... Wait, physically this is 1 PC?
        // Or we assume click source? 
        // For physical dome, someone tapping a hub is just "Interaction".
        // Who are they? 
        // This is the tricky part of "Physical Dome".
        // THE SENSORS.
        // If the hub reports a touch, it reports "Hub 53 touched".
        // It doesn't know if it's Red or Blue team.
        // So Pulse Wars on physical dome relies on geography.
        // If touched, and adjacent to Red, Red charges it.
        // If adjacent to Blue, Blue charges it.
        // If adjacent to BOTH... Contest? Or whoever is stronger? 
        // Let's implement geography based logic.

        let charger = 0;
        if (adjRed && !adjBlue) charger = 1;
        else if (adjBlue && !adjRed) charger = 2;
        else if (adjRed && adjBlue) {
            // Contest: Random or based on current charge owner
            charger = node.chargeTeam || 1;
        }

        if (charger === 0) return; // Isolated node

        // Charging
        if (node.capturedBy === charger) return; // Already owned

        if (node.chargeTeam !== charger) {
            // Switching teams reduces charge first
            node.ringCharge -= 2;
            if (node.ringCharge <= 0) {
                node.chargeTeam = charger;
                node.ringCharge = 1;
            }
        } else {
            node.ringCharge += 2;
            if (node.ringCharge >= 12) {
                node.capturedBy = charger;
                node.ringCharge = 0;
                // Effect
                node.pulseIntensity = 1;
            }
        }
    }

    getNeighbors(node) {
        // brute force via edges
        const neighborIds = [];
        this.dome.edges.forEach(e => {
            if (e.a === node.id) neighborIds.push(e.b);
            if (e.b === node.id) neighborIds.push(e.a);
        });
        return neighborIds.map(id => this.dome.nodes[id]);
    }
}
