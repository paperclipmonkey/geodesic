import { ChainGame } from './games/chain.js';
import { ResonanceGame } from './games/resonance.js';
import { PulseWarsGame } from './games/pulse_wars.js';
import { SnakeGame } from './games/snake.js';
import { BreathingGame } from './games/breathing.js';
import { ManualGame } from './games/manual.js';
import { ValidationGame } from './games/validation.js';

export class GameEngine {
    constructor(dome, renderer, hardware, ui, particleSystem, soundManager) {
        this.dome = dome;
        this.renderer = renderer;
        this.hardware = hardware;
        this.ui = ui;
        this.particleSystem = particleSystem;
        this.soundManager = soundManager;

        this.games = {
            chain: new ChainGame(dome, ui, particleSystem, soundManager),
            resonance: new ResonanceGame(dome, ui, particleSystem, soundManager),
            pulsewars: new PulseWarsGame(dome, ui, particleSystem, soundManager),
            snake: new SnakeGame(dome, ui, particleSystem, soundManager),
            breathing: new BreathingGame(dome, ui, particleSystem, soundManager),
            manual: new ManualGame(dome, ui, particleSystem, soundManager),
            validation: new ValidationGame(dome, ui, particleSystem, soundManager)
        };

        this.currentGame = null;
        this.lastTime = 0;

        // Bind input
        this.setupInput();
    }

    setupInput() {
        this.renderer.canvas.addEventListener('mousedown', (e) => {
            const rect = this.renderer.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.handleInteraction(x, y);
        });

        // Touch support
        this.renderer.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const rect = this.renderer.canvas.getBoundingClientRect();
            const t = e.touches[0];
            const x = t.clientX - rect.left;
            const y = t.clientY - rect.top;
            this.handleInteraction(x, y);
        }, { passive: false });

        // Bind Network Input
        if (this.hardware && this.hardware.onButtonPress === null) {
            this.hardware.onButtonPress = (nodeId, pressed) => {
                this.handleNetworkInput(nodeId, pressed);
            };
        }
    }

    handleNetworkInput(nodeId, pressed) {
        if (!pressed) return; // Only trigger on press down
        const node = this.dome.nodes.find(n => n.id === nodeId);
        if (node && this.currentGame) {
            console.log(`[GameEngine] Network Input from Node ${nodeId}`);
            this.currentGame.onInteract(node);
        }
    }

    async start(gameName = 'chain') {
        this.switchGame(gameName);
        this.lastTime = performance.now();
        requestAnimationFrame(this.loop.bind(this));
    }

    switchGame(name) {
        if (this.currentGame) {
            this.currentGame.stop();
        }

        // Full Dome Reset
        this.resetDome();

        this.currentGame = this.games[name];
        if (this.currentGame) {
            this.currentGame.start();
        }
    }

    resetDome() {
        this.dome.nodes.forEach(n => {
            n.pulseIntensity = 0;
            n.color = null;
            n.capturedBy = null;
            n.owner = null;
            n.ringCharge = 0;
            n.chargeTeam = null;
            n.chainLit = false;
            n.isTarget = false;
            // Clear LED Ring
            if (n.leds) n.leds.fill(0);
        });

        this.dome.edges.forEach(e => {
            e.intensity = 0;
            e.color = null;
            e.capturedBy = null;
            e.chargeRatio = 0;
            // Clear Strut LEDs
            if (e.pixelData) e.pixelData.fill(0);
        });

        // Clear particles
        if (this.particleSystem) {
            this.particleSystem.particles = [];
        }
    }

    handleInteraction(x, y) {
        // Raycast / Hit test
        const node = this.renderer.getNodeAt(x, y);
        if (node) {
            // Instead of triggering game logim immediately,
            // we trigger the PHYSICAL BUTTON on the VIRTUAL NODE.
            // This tests the full loop: Click -> Virtual HW -> RS485 -> NetworkManager -> GameEngine

            if (node.virtualNode) {
                node.virtualNode.pressButton();
                // Release after short delay to simulate click
                setTimeout(() => node.virtualNode.releaseButton(), 100);
            }
        }
    }

    loop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // 1. Game Logic (Logical State Update)
        if (this.currentGame) {
            this.currentGame.update(dt);
        }

        // 2. LOGICAL -> HARDWARE (Send Commands)
        // Iterate nodes, check logical state, send RS485 commands
        this.dome.nodes.forEach(node => {
            // Calculate Desired Color based on Game Logic
            // This replicates the logic previously hidden in Renderer.getNodeColor
            // But we need to be explicit now.

            let r = 0, g = 0, b = 0;

            // Priority Logic (Simplified)
            if (node.capturedBy === 1) { r = 255; }
            else if (node.capturedBy === 2) { b = 255; }
            else if (node.pulseIntensity > 0) {
                const val = Math.floor(node.pulseIntensity * 255);
                r = val; g = val; b = val;
            } else if (node.color) {
                // Try to parse rgb/hex... simplistic fallback
                r = 255; g = 255; b = 255;
            }

            // Send to Network Manager
            // Optimization: Only send if changed? 
            // For simulation, we can blast it (VirtualBus is fast).
            // But to be realistic, we should check diff.
            // Leaving optimization for later.

            // Struts?
            // We need to decide what color the struts should be.
            // For now, let's just make struts match the hub for simple debug,
            // or 0 if we want to be strict.
            // The Game Logic usually sets `edge.intensity` etc.

            // Just sending Hub Color for now to prove concept
            // Sending 0 for struts unless we calculate them.
            this.hardware.setColor(node.id, r, g, b, 0, 0, 0);
        });

        // 3. HARDWARE -> RENDERER (Visualization)
        // Sync Virtual Hardware State to Dome Node State for Rendering
        // Only if the game does NOT manage pixel data itself (High Fidelity vs Low Fidelity)
        let skipHWSync = false;
        if (this.currentGame && this.currentGame.managesPixelData) {
            skipHWSync = true;
        }

        if (!skipHWSync) {
            this.dome.nodes.forEach(node => {
                if (node.virtualNode) {
                    // Map Virtual Node LED state to Renderer State

                    // --- HUB ---
                    const hr = node.virtualNode.leds.hub[0];
                    const hg = node.virtualNode.leds.hub[1];
                    const hb = node.virtualNode.leds.hub[2];

                    // Update the `leds` array which Renderer uses
                    // Fill all 12 LEDs with the hub color (since HW sim is 1-zone for now)
                    for (let i = 0; i < 12; i++) {
                        const idx = i * 3;
                        node.leds[idx] = hr;
                        node.leds[idx + 1] = hg;
                        node.leds[idx + 2] = hb;
                    }

                    // --- STRUTS ---
                    // Map virtualNode.leds.struts[i] to node.drivenEdges[i]
                    node.drivenEdges.forEach((edgeIdx, i) => {
                        if (i < 3) { // HW limit
                            const sColor = node.virtualNode.leds.struts[i];
                            const edge = this.dome.edges[edgeIdx];
                            if (edge) {
                                // Update Pixel Data
                                // Fill entire strut
                                const count = edge.ledCount;
                                for (let p = 0; p < count; p++) {
                                    const pIdx = p * 3;
                                    edge.pixelData[pIdx] = sColor[0];
                                    edge.pixelData[pIdx + 1] = sColor[1];
                                    edge.pixelData[pIdx + 2] = sColor[2];
                                }
                            }
                        }
                    });
                }
            });
        }

        if (this.particleSystem) this.particleSystem.update();
        this.renderer.draw();

        // POLL INPUTS
        // The NetworkManager is polling automatically (via setInterval or internally).
        // We just need to handle the callbacks, which we bound in setupInput/constructor.


        requestAnimationFrame(this.loop.bind(this));
    }
}
