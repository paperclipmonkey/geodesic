export class ChainGame {
    constructor(dome, ui, particleSystem) {
        this.dome = dome;
        this.ui = ui; // callback interface for score updates
        this.particleSystem = particleSystem;

        this.level = 1;
        this.targetHub = null;
        this.hubsLit = 0;

        // Timing Logic
        this.baseTimePerNode = 5.0;
        this.timeRemaining = 0;
        this.timerRunning = false;

        this.active = false;
        this.winCondition = 10; // Hubs required for Level 1

        this.gameState = 'IDLE'; // IDLE, PLAYING, WON, LOST, COUNTDOWN
        this.transitionTimer = 0;
        this.countdownValue = 0;
    }

    start() {
        this.active = true;
        this.level = 1;
        this.baseTimePerNode = 5.0;
        this.winCondition = 10;
        this.gameState = 'PLAYING';
        this.resetRound();
        this.spawnTarget();
        this.ui.updateStatus("Chain Reaction: LEVEL 1");
    }

    stop() {
        this.active = false;
        this.gameState = 'IDLE';
        this.timerRunning = false;
        this.dome.nodes.forEach(n => {
            n.chainLit = false;
            n.pulseIntensity = 0;
            n.isTarget = false;
            n.capturedBy = null;
            n.owner = null;
        });
        this.dome.edges.forEach(e => {
            e.capturedBy = null;
            if (e.pixelData) e.pixelData.fill(0);
        });
    }

    resetRound() {
        this.hubsLit = 0;
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
        if (!this.active) return;

        if (this.gameState === 'COUNTDOWN') {
            this.transitionTimer -= dt;
            if (this.transitionTimer <= 0) {
                this.countdownValue--;
                if (this.countdownValue > 0) {
                    this.transitionTimer = 0.8; // 0.8s beat
                    this.flashAllNodes(0.8, '#ffffff'); // Strong flash
                } else {
                    this.gameState = 'PLAYING';
                    this.resetRound(); // Clear flash
                    this.spawnTarget();
                    this.ui.updateStatus(`Level ${this.level} - START!`);
                }
            }
            return;
        }

        if (this.gameState !== 'PLAYING') return;

        // Timer Logic
        if (this.timerRunning || this.hubsLit === 0) { // Keep pulsing even if timer hasn't started for first node
            if (this.timerRunning) this.timeRemaining -= dt;

            if (this.targetHub !== null) {
                const n = this.dome.nodes[this.targetHub];

                // Adaptive Blink Speed
                // Slower when lots of time, very fast when < 2s
                let blinkSpeed = 200; // Base speed divisor

                if (this.timeRemaining < 2.0) blinkSpeed = 50;
                else if (this.timeRemaining < 5.0) blinkSpeed = 100;

                // Ensure it's always visible (0.2 to 1.0)
                n.pulseIntensity = 0.2 + 0.8 * Math.sin(Date.now() / blinkSpeed);
                n.isTarget = true; // Force logic
                n.capturedBy = 2; // Force Blue Color
            }

            if (this.timerRunning && this.timeRemaining <= 0) {
                this.gameOver(false);
            }
        }

        // Decay others
        this.dome.nodes.forEach(n => {
            if (n.id !== this.targetHub && n.pulseIntensity > 0) {
                n.pulseIntensity *= 0.92;
            }
        });

        // Fade LED trails on struts
        this.dome.edges.forEach(e => {
            if (e.pixelData) {
                for (let i = 0; i < e.pixelData.length; i++) {
                    if (e.pixelData[i] > 0) {
                        e.pixelData[i] = Math.floor(e.pixelData[i] * 0.80);
                    }
                }
            }
        });

        this.updateUI();
    }

    flashAllNodes(intensity, color) {
        this.dome.nodes.forEach(n => {
            n.pulseIntensity = intensity;
            // Temporarily use capturedBy for specific color during flash if needed
            // but white is just pulseIntensity.
        });
        if (this.particleSystem) {
            // Burst from center?
            this.particleSystem.spawn(window.innerWidth / 2, window.innerHeight / 2, color, 20);
        }
    }

    onInteract(node) {
        if (!this.active || this.gameState !== 'PLAYING') return;

        if (node.id === this.targetHub) {
            if (!this.timerRunning) this.timerRunning = true;

            node.chainLit = true;
            node.isTarget = false;
            node.pulseIntensity = 1;
            this.hubsLit++;

            const speedUp = Math.min(2.0, this.hubsLit * 0.1);
            this.timeRemaining = Math.max(1.0, this.baseTimePerNode - speedUp);

            if (this.particleSystem) {
                this.particleSystem.spawn(node.sx, node.sy, '#00ff9d');
            }

            if (this.hubsLit >= this.winCondition) {
                this.levelUp();
            } else {
                this.spawnTarget();
            }
        } else if (!node.chainLit) {
            this.timeRemaining -= 1.0;
            if (this.particleSystem) {
                this.particleSystem.spawn(node.sx, node.sy, '#ff0055', 5);
            }
        }
    }

    levelUp() {
        this.timerRunning = false;
        this.gameState = 'WON'; // intermediate state
        this.ui.showNotification(`LEVEL ${this.level} COMPLETE!`, "success");

        // Win Animation: Double Shockwave
        // 1. Expand outward (White/Bright)
        const centerNode = this.targetHub !== null ? this.dome.nodes[this.targetHub] : this.dome.nodes[0];

        this.dome.nodes.forEach(n => {
            const dist = this.getDist(centerNode.p3, n.p3);

            // Outward White Pulse (Shockwave)
            setTimeout(() => {
                n.pulseIntensity = 1.0; // Blooms white
                n.chainLit = true;      // Underlying color is green
                // Struts will light up due to node color
            }, dist * 300); // Faster ripple

            // Secondary Glitter
            setTimeout(() => {
                if (Math.random() > 0.6) n.pulseIntensity = 0.8;
            }, dist * 300 + 200);
        });

        // Delay next level start
        setTimeout(() => this.startCountdown(), 3000);
    }

    startCountdown() {
        // Hard Reset: Turn everything OFF first
        this.dome.nodes.forEach(n => {
            n.chainLit = false;
            n.pulseIntensity = 0;
            n.isTarget = false;
            n.capturedBy = null;
        });

        this.gameState = 'COUNTDOWN';
        this.countdownValue = 3;
        this.transitionTimer = 0.8; // Slower cadence for 3-2-1

        this.level++;
        this.winCondition += 5;
        this.baseTimePerNode = Math.max(2.5, this.baseTimePerNode - 0.5);

        this.ui.updateStatus(`Level ${this.level} Ready...`);
    }

    spawnTarget() {
        const candidates = this.dome.nodes.filter(n => !n.chainLit);
        if (candidates.length === 0) return;

        let selectedNode;
        if (this.targetHub !== null) {
            const currentPos = this.dome.nodes[this.targetHub].p3;
            // Dynamic difficulty: favor distant nodes based on level
            // Weight = distance ^ (0.5 + level * 0.2)
            const power = 0.5 + this.level * 0.3;

            let totalWeight = 0;
            const weightedCandidates = candidates.map(n => {
                const d = this.getDist(currentPos, n.p3);
                const weight = Math.pow(d, power);
                totalWeight += weight;
                return { node: n, weight };
            });

            let r = Math.random() * totalWeight;
            for (const cand of weightedCandidates) {
                r -= cand.weight;
                if (r <= 0) {
                    selectedNode = cand.node;
                    break;
                }
            }
        }

        if (!selectedNode) selectedNode = candidates[Math.floor(Math.random() * candidates.length)];

        // Tracer
        if (this.targetHub !== null && this.particleSystem) {
            const path = this.dome.findPath(this.targetHub, selectedNode.id);
            if (path) {
                this.particleSystem.spawnPathTracer(path, '#ff00ff');
            }
        }

        this.targetHub = selectedNode.id;
        const targetNode = this.dome.nodes[this.targetHub];
        targetNode.isTarget = true;
        targetNode.capturedBy = 2; // Blue Target
    }

    getDist(a, b) {
        return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2));
    }

    updateUI() {
        if (this.ui) {
            this.ui.updateScore({
                p1: this.hubsLit,
                label: `Lvl ${this.level} - Hubs`,
                timer: this.timerRunning ? this.timeRemaining.toFixed(1) : "--"
            });
        }
    }

    gameOver(win) {
        this.timerRunning = false;
        this.targetHub = null;

        if (!win) {
            this.gameState = 'LOST';
            this.ui.showNotification("CRITICAL FAILURE", "error");

            // Red Pulse Animation (3 seconds)
            this.dome.nodes.forEach(n => {
                n.isTarget = false;
                n.chainLit = false;
                n.capturedBy = 1; // Red
            });
            // Flash Edges too
            this.dome.edges.forEach(e => {
                e.capturedBy = 1;
                if (e.pixelData) e.pixelData.fill(0); // Clear LED trails
            });

            // Pulse loop
            const startTime = Date.now();
            const animateFail = () => {
                if (this.gameState !== 'LOST') return;

                const now = Date.now();
                const elapsed = now - startTime;

                if (elapsed >= 3000) {
                    // Reset and Restart
                    this.dome.nodes.forEach(n => {
                        n.capturedBy = null;
                        n.pulseIntensity = 0;
                    });
                    this.start(); // Restart at Level 1, which cleans up and spawns target
                    return;
                }

                // Sin wave pulse
                const pulse = 0.5 + 0.5 * Math.sin(elapsed / 150);
                this.dome.nodes.forEach(n => n.pulseIntensity = pulse);
                requestAnimationFrame(animateFail);
            };

            animateFail();
        }
    }
}
