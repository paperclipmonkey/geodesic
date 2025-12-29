import { Dome } from './dome.js';
import { Renderer } from './renderer.js';
import { SerialLEDs } from './hardware/serial_leds.js';
import { GameEngine } from './game_engine.js';
import { ParticleSystem } from './particle_system.js';

// UI Helper
const UI = {
    statusEl: document.getElementById('status-text'),
    scoreEl: document.getElementById('score-val'),
    notificationArea: document.getElementById('notification-area'),

    updateStatus(text) {
        if (this.statusEl) this.statusEl.textContent = text;
    },

    updateScore(data) {
        // Generic display handler
        if (data.label && this.scoreEl) {
            let text = `${data.label}: `;
            if (data.p1 !== undefined) text += `${data.p1} `;
            if (data.p2 !== undefined) text += `vs ${data.p2}`;
            if (data.timer !== undefined) text += ` | ⏱ ${data.timer}s`;
            this.scoreEl.textContent = text;
        }
    },

    showNotification(text, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = text;
        this.notificationArea.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
};

// Bootstrap
async function init() {
    console.log("Initializing Dome OS...");

    const canvas = document.getElementById('canvas');
    const dome = new Dome();
    const particleSystem = new ParticleSystem();
    const renderer = new Renderer(canvas, dome, particleSystem);
    const hardware = new SerialLEDs();

    const engine = new GameEngine(dome, renderer, hardware, UI, particleSystem);

    // Bind UI Controls
    document.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('click', () => {
            // UI Active state
            document.querySelectorAll('.game-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            const game = card.dataset.game;
            engine.switchGame(game);
        });
    });

    document.getElementById('btn-calibrate').addEventListener('click', () => {
        UI.showNotification("Calibrating...", "info");
        // Blink all nodes white
        dome.nodes.forEach(n => { n.pulseIntensity = 1; n.owner = null; n.capturedBy = null; });
        setTimeout(() => {
            dome.nodes.forEach(n => n.pulseIntensity = 0);
            UI.showNotification("Calibration Complete", "success");
        }, 1000);
    });

    const connectBtn = document.getElementById('btn-connect');
    const statusDot = document.querySelector('.status-dot');

    connectBtn.addEventListener('click', async () => {
        if (!hardware.isConnected) {
            const success = await hardware.connect();
            if (success) {
                connectBtn.textContent = "DISCONNECT HARDWARE";
                connectBtn.classList.replace('btn-primary', 'btn-danger');
                statusDot.classList.add('connected');
                UI.showNotification("Hardware Connected", "success");
            }
        } else {
            await hardware.disconnect();
            connectBtn.textContent = "CONNECT RS485";
            connectBtn.classList.replace('btn-danger', 'btn-primary');
            statusDot.classList.remove('connected');
            UI.showNotification("Hardware Disconnected", "info");
        }
    });

    document.getElementById('toggle-rotate').addEventListener('click', () => {
        renderer.autoRotate = !renderer.autoRotate;
    });

    // Start Default
    engine.start('chain');
}

window.addEventListener('DOMContentLoaded', init);
