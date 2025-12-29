import { ChainGame } from './games/chain.js';
import { ResonanceGame } from './games/resonance.js';
import { PulseWarsGame } from './games/pulse_wars.js';

export class GameEngine {
    constructor(dome, renderer, hardware, ui, particleSystem) {
        this.dome = dome;
        this.renderer = renderer;
        this.hardware = hardware;
        this.ui = ui;
        this.particleSystem = particleSystem;

        this.games = {
            chain: new ChainGame(dome, ui, particleSystem),
            resonance: new ResonanceGame(dome, ui, particleSystem),
            pulsewars: new PulseWarsGame(dome, ui, particleSystem)
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
        this.currentGame = this.games[name];
        if (this.currentGame) {
            this.currentGame.start();
        }
    }

    handleInteraction(x, y) {
        // Raycast / Hit test
        const node = this.renderer.getNodeAt(x, y);
        if (node && this.currentGame) {
            this.currentGame.onInteract(node);
        }
    }

    loop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Update Game Logic
        if (this.currentGame) {
            this.currentGame.update(dt);
        }

        // Render Visuals
        if (this.particleSystem) this.particleSystem.update();
        this.renderer.draw();

        // Update Hardware
        if (this.hardware.isConnected) {
            this.hardware.update(this.dome.nodes);
        }

        requestAnimationFrame(this.loop.bind(this));
    }
}
