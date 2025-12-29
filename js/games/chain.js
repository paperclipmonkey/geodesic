export class ChainGame {
    constructor(dome, ui, particleSystem) {
        this.dome = dome;
        this.ui = ui; // callback interface for score updates
        this.particleSystem = particleSystem;

        this.round = 1;
        this.targetHub = null;
        this.hubsLit = 0;
        this.timeLimit = 45;
        this.timeRemaining = 45;
        this.timerRunning = false;
        this.active = false;

        this.winCondition = 26; // Approx number of nodes
    }

    start() {
        this.active = true;
        this.resetRound();
        this.spawnTarget();
        this.ui.updateStatus("Chain Reaction: Hit the green targets!");
    }

    stop() {
        this.active = false;
        // Cleanup visual state
        this.dome.nodes.forEach(n => {
            n.chainLit = false;
            n.pulseIntensity = 0;
            n.isTarget = false;
        });
    }

    resetRound() {
        this.hubsLit = 0;
        this.round = 1;
        this.timeLimit = 45;
        this.timeRemaining = this.timeLimit;
        this.timerRunning = false;

        this.dome.nodes.forEach(n => {
            n.chainLit = false;
            n.pulseIntensity = 0;
            n.isTarget = false;
        });

        this.updateUI();
    }

    update(dt) {
        if (!this.active) return;

        // Decay pulse
        this.dome.nodes.forEach(n => {
            if (n.pulseIntensity > 0) n.pulseIntensity *= 0.92;
        });

        if (this.timerRunning) {
            this.timeRemaining -= dt;
            if (this.timeRemaining <= 0) {
                this.gameOver(false);
            }
        }
        this.updateUI();
    }

    onInteract(node) {
        if (!this.active) return;

        if (node.id === this.targetHub) {
            // Success
            if (!this.timerRunning) this.timerRunning = true;

            node.chainLit = true;
            node.isTarget = false;
            node.pulseIntensity = 1;
            this.hubsLit++;

            if (this.particleSystem) {
                this.particleSystem.spawn(node.sx, node.sy, '#00ff9d');
            }

            // Audio
            // playSuccess(); // We will need to inject audio context or use event

            if (this.hubsLit >= this.winCondition) {
                this.gameOver(true);
            } else {
                this.spawnTarget();
            }
        } else if (node.chainLit) {
            // Already lit
        } else {
            // Miss
            node.pulseIntensity = 0.5; // Red flash?
            this.timeRemaining -= 2; // Penalty
        }
    }

    spawnTarget() {
        // Find unlit hub
        const candidates = this.dome.nodes.filter(n => !n.chainLit);
        if (candidates.length === 0) return;

        const idx = Math.floor(Math.random() * candidates.length);
        const newTargetId = candidates[idx].id;

        // Handle tracer from old target
        // Handle tracer from old target
        if (this.targetHub !== null && this.particleSystem) {
            // Find path using Dome BFS
            const path = this.dome.findPath(this.targetHub, newTargetId);
            if (path) {
                this.particleSystem.spawnPathTracer(path, '#ff00ff');
            }
        }

        this.targetHub = newTargetId;
        this.dome.nodes[this.targetHub].isTarget = true;
    }

    // We need to inject the target visual into the node so renderer sees it
    // Actually, let's pulse the target in update()

    updateUI() {
        if (this.ui) {
            this.ui.updateScore({
                p1: this.hubsLit,
                label: "Hubs",
                timer: Math.ceil(this.timeRemaining)
            });
        }

        // Pulse target
        // Pulse target for extra effect (optional, or rely on gold color)
        if (this.targetHub !== null) {
            const n = this.dome.nodes[this.targetHub];
            n.pulseIntensity = 0.3 + 0.3 * Math.sin(Date.now() / 200);
        }
    }

    gameOver(win) {
        this.active = false;
        this.timerRunning = false;
        this.targetHub = null;

        if (win) {
            this.ui.showNotification("ROUND CLEARED! +Speed", "success");
            setTimeout(() => {
                this.round++;
                this.timeLimit = Math.max(15, 45 - (this.round * 5));
                this.timeRemaining = this.timeLimit;
                this.hubsLit = 0;
                this.dome.nodes.forEach(n => n.chainLit = false);
                this.start();
            }, 2000);
        } else {
            this.ui.showNotification("GAME OVER", "error");
        }
    }
}
