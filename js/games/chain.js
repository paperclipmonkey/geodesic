export class ChainGame {
    constructor(dome, ui, particleSystem) {
        this.dome = dome;
        this.ui = ui; // callback interface for score updates
        this.particleSystem = particleSystem;

        this.round = 1;
        this.targetHub = null;
        this.hubsLit = 0;

        // New Timing Logic
        this.baseTimePerNode = 5.0; // Seconds to hit next node
        this.timeRemaining = 0;
        this.timerRunning = false;

        this.active = false;
        this.winCondition = 26;

        this.gameState = 'IDLE'; // IDLE, PLAYING, WON, LOST
    }

    start() {
        this.active = true;
        this.gameState = 'PLAYING';
        this.resetRound();
        this.spawnTarget();
        this.ui.updateStatus("Chain Reaction: KEEP IT ALIVE!");
    }

    stop() {
        this.active = false;
        this.gameState = 'IDLE';
        // Cleanup visual state
        this.dome.nodes.forEach(n => {
            n.chainLit = false;
            n.pulseIntensity = 0;
            n.isTarget = false;
            n.capturedBy = null; // reused for color states if needed
            n.owner = null;
        });
    }

    resetRound() {
        this.hubsLit = 0;
        this.round = 1;
        this.timerRunning = false;
        this.timeRemaining = this.baseTimePerNode;

        this.dome.nodes.forEach(n => {
            n.chainLit = false;
            n.pulseIntensity = 0;
            n.isTarget = false;
        });

        this.updateUI();
    }

    update(dt) {
        if (!this.active || this.gameState !== 'PLAYING') {
            this.handleEndGameEffects(); // Optional: continue animations
            return;
        }

        // Timer Logic
        if (this.timerRunning) {
            this.timeRemaining -= dt;

            // Urgency Flashing
            if (this.targetHub !== null) {
                const n = this.dome.nodes[this.targetHub];
                if (this.timeRemaining < 2.0) {
                    // Fast flash Red/Magenta
                    const phase = Math.sin(Date.now() / 50); // Fast pulse
                    // Toggle color? We can't easily swap color in renderer without property
                    // But we can modulate intensity wildly
                    n.pulseIntensity = 0.5 + 0.5 * phase;
                    // To show red urgency, maybe use 'capturedBy=1' (Red) temporarily? 
                    // No, let's keep it simple: Just super fast pulsing.
                } else {
                    // Normal pulse
                    n.pulseIntensity = 0.3 + 0.4 * Math.sin(Date.now() / 200);
                }
            }

            if (this.timeRemaining <= 0) {
                this.gameOver(false);
            }
        }

        // Decay others
        this.dome.nodes.forEach(n => {
            if (n.id !== this.targetHub && n.pulseIntensity > 0) {
                n.pulseIntensity *= 0.92;
            }
        });

        this.updateUI();
    }

    handleEndGameEffects() {
        // Just keep existing particles updating in main loop
    }

    onInteract(node) {
        if (!this.active || this.gameState !== 'PLAYING') return;

        if (node.id === this.targetHub) {
            // Success
            if (!this.timerRunning) this.timerRunning = true;

            // Visuals
            node.chainLit = true;
            node.isTarget = false;
            node.pulseIntensity = 1;
            this.hubsLit++;

            // Reset Timer for next node
            // Maybe gets slightly faster each time?
            const speedUp = Math.min(2.0, this.hubsLit * 0.05);
            this.timeRemaining = Math.max(1.5, this.baseTimePerNode - speedUp);

            // Particles
            if (this.particleSystem) {
                this.particleSystem.spawn(node.sx, node.sy, '#00ff9d'); // Green burst
            }

            if (this.hubsLit >= this.winCondition) {
                this.gameOver(true);
            } else {
                this.spawnTarget();
            }
        } else if (node.chainLit) {
            // Already lit - ignore
        } else {
            // Miss - Penalty?
            this.timeRemaining -= 1.0;
            if (this.particleSystem) {
                this.particleSystem.spawn(node.sx, node.sy, '#ff0055', 5); // Red puff
            }
        }
    }

    spawnTarget() {
        const candidates = this.dome.nodes.filter(n => !n.chainLit);
        if (candidates.length === 0) return;

        const idx = Math.floor(Math.random() * candidates.length);
        const newTargetId = candidates[idx].id;

        // Tracer
        if (this.targetHub !== null && this.particleSystem) {
            const path = this.dome.findPath(this.targetHub, newTargetId);
            if (path) {
                this.particleSystem.spawnPathTracer(path, '#ff00ff');
            }
        }

        this.targetHub = newTargetId;
        this.dome.nodes[this.targetHub].isTarget = true;
    }

    updateUI() {
        if (this.ui) {
            this.ui.updateScore({
                p1: this.hubsLit,
                label: "Hubs",
                timer: this.timerRunning ? this.timeRemaining.toFixed(1) : "--"
            });
        }
    }

    gameOver(win) {
        this.timerRunning = false;
        this.targetHub = null;

        if (win) {
            this.gameState = 'WON';
            this.ui.showNotification("SYSTEM SECURTITY RESTORED!", "success");

            // Win Animation: Green Ripple / Explosion on all nodes
            this.dome.nodes.forEach((n, i) => {
                setTimeout(() => {
                    n.pulseIntensity = 1;
                    n.chainLit = true; // Stay green
                    if (Math.random() > 0.7 && this.particleSystem) {
                        this.particleSystem.spawnExplosion(n.sx, n.sy, '#00ff9d');
                    }
                }, i * 20);
            });

            setTimeout(() => this.start(), 4000);

        } else {
            this.gameState = 'LOST';
            this.ui.showNotification("CRITICAL FAILURE", "error");

            // Loss Animation: Red Flash then Fade
            this.dome.nodes.forEach(n => {
                n.isTarget = false;
                n.chainLit = false;
                n.capturedBy = 1; // Hack: Turn red using 'PulseWars' color slot
                n.pulseIntensity = 1;
            });

            setTimeout(() => {
                // Fade out redness
                this.dome.nodes.forEach(n => {
                    n.capturedBy = null;
                    n.pulseIntensity = 0;
                });
                this.start();
            }, 3000);
        }
    }
}
