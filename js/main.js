import { Dome } from './dome.js?v=10';
import { Renderer } from './renderer.js?v=10';
import { SoundManager } from './sound_manager.js';
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
    const particleSystem = new ParticleSystem(dome);
    const renderer = new Renderer(canvas, dome, particleSystem);

    // --- Hardware Simulation Setup ---
    console.log("Initializing Virtual Hardware...");

    const { VirtualBus } = await import('./hardware/virtual_bus.js');
    const { VirtualNode } = await import('./hardware/virtual_node.js');
    const { NetworkManager } = await import('./hardware/network_manager.js');

    const bus = new VirtualBus();
    const networkManager = new NetworkManager(bus);

    // Create Virtual Nodes for every Dome Node
    dome.nodes.forEach(node => {
        const vNode = new VirtualNode(node.id, bus);
        bus.registerNode(vNode);
        node.virtualNode = vNode; // Link for visualization debug/magic if needed
    });

    const soundManager = new SoundManager();

    // GameEngine now uses NetworkManager
    const engine = new GameEngine(dome, renderer, networkManager, UI, particleSystem, soundManager);

    // Resume Audio Context on first interaction
    const unlockAudio = () => {
        soundManager.resume();
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);


    // Bind UI Controls
    document.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('click', () => {
            // UI Active state
            document.querySelectorAll('.game-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            const game = card.dataset.game;
            engine.switchGame(game);

            // Manual Controls Visibility
            const manualControls = document.getElementById('manual-controls');
            if (game === 'manual') {
                manualControls.style.display = 'block';
            } else {
                manualControls.style.display = 'none';
            }
        });
    });

    // Manual Mode Bindings
    const manualColor = document.getElementById('manual-color');
    const manualIntensity = document.getElementById('manual-intensity');

    const updateManual = () => {
        const game = engine.games.manual;
        const hex = manualColor.value;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        game.setColor(r, g, b);
        game.setIntensity(parseFloat(manualIntensity.value));
    };

    manualColor.addEventListener('input', updateManual);
    manualIntensity.addEventListener('input', updateManual);

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

    // Virtual Bus is always connected
    UI.showNotification("Virtual Bus Active", "success");
    statusDot.classList.add('connected');
    connectBtn.style.display = 'none'; // Hide connect button for virtual mode

    /*
    connectBtn.addEventListener('click', async () => {
        if (!hardware.isConnected) {
    */
    // Virtual Mode is always "connected" in this new paradigm
    // But we can simulate "Connecting to Real RS485" vs "Simulation" later.
    // For now, let's just say we are connected.
    UI.showNotification("Virtual Bus Active", "success");
    statusDot.classList.add('connected');
    /*
        const success = await hardware.connect();
        if (success) {
            connectBtn.textContent = "DISCONNECT HARDWARE";
            connectBtn.classList.replace('btn-primary', 'btn-danger');
            statusDot.classList.add('connected');
            UI.showNotification("Hardware Connected", "success");
        }
    */
    /*
    connectBtn.addEventListener('click', async () => {
        if (!hardware.isConnected) {
            const success = await hardware.connect();
            // ...
        } else {
            await hardware.disconnect();
            // ...
        }
    });
    */

    const toggleBtn = document.getElementById('toggle-rotate');
    // Set initial state
    if (renderer.autoRotateEnabled) toggleBtn.classList.add('active');

    toggleBtn.addEventListener('click', () => {
        renderer.autoRotateEnabled = !renderer.autoRotateEnabled;
        renderer.autoRotate = renderer.autoRotateEnabled;
        toggleBtn.classList.toggle('active', renderer.autoRotateEnabled);
    });

    // Sidebar Collapse
    const panel = document.getElementById('panel');
    const btnCollapse = document.getElementById('btn-collapse');
    const btnExpand = document.getElementById('btn-expand');

    btnCollapse.addEventListener('click', () => {
        panel.classList.add('collapsed');
        btnExpand.classList.add('visible');
        setTimeout(() => renderer.resize(), 350); // Trigger canvas resize
    });

    btnExpand.addEventListener('click', () => {
        panel.classList.remove('collapsed');
        btnExpand.classList.remove('visible');
        setTimeout(() => renderer.resize(), 350);
    });

    // Start Default
    engine.start('chain');

    // Automation Helpers
    window.GeodesicHelper = {
        getGameState: () => {
            const game = engine.currentGame;
            return {
                name: engine.activeGameId,
                active: game ? game.active : false,
                level: game ? game.level : 0,
                score: game ? game.hubsLit || (game.redIndex + "-" + game.blueIndex) : 0
            };
        },
        getNodeScreenPositions: () => {
            return renderer.dome.nodes.map(n => ({
                id: n.id,
                x: Math.round(n.sx),
                y: Math.round(n.sy),
                isTarget: n.isTarget, // Helpful to find what to click
                color: n.capturedBy // Helpful for team checks
            }));
        },
        triggerNode: (nodeId) => {
            const node = dome.nodes.find(n => n.id === nodeId);
            if (node && engine.currentGame) {
                console.log(`[Automation] Triggering interaction on Node ${nodeId}`);
                engine.currentGame.onInteract(node);
                return true;
            }
            console.warn(`[Automation] Node ${nodeId} not found or game not active`);
            return false;
        },
        switchGame: (gameId) => {
            console.log(`[Automation] Switching to game: ${gameId}`);
            engine.switchGame(gameId);
            // Update UI card active state
            document.querySelectorAll('.game-card').forEach(c => {
                if (c.dataset.game === gameId) c.classList.add('active');
                else c.classList.remove('active');
            });
            return true;
        }
    };
}

window.addEventListener('DOMContentLoaded', init);
