export class ValidationGame {
    constructor(dome, ui, particleSystem, soundManager) {
        this.dome = dome;
        this.ui = ui;
        this.particleSystem = particleSystem;
        this.soundManager = soundManager;
        this.active = false;
    }

    start() {
        this.active = true;
        this.ui.updateStatus("Mode: System Validation");
        this.dome.nodes.forEach(n => { n.color = 'rgb(30, 36, 51)'; n.pulseIntensity = 0; });
        this.dome.edges.forEach(e => { e.color = 'rgb(30, 36, 51)'; e.intensity = 0; });
    }

    stop() {
        this.active = false;
        this.dome.nodes.forEach(n => n.color = null);
        this.dome.edges.forEach(e => { e.color = null; e.intensity = 0; });
    }

    update(dt) {
        // Static
    }

    onInteract(node) {
        if (!this.active) return;

        // "Paint" the node and connected edges
        node.color = 'rgb(255, 255, 255)';
        node.pulseIntensity = 1.0;
        node.isTagged = true; // Use a custom flag to keep it lit
        if (this.soundManager) this.soundManager.playSound('click');

        // Find edges connected to this node
        this.dome.edges.forEach(e => {
            if (e.a === node.id || e.b === node.id) {
                e.color = 'rgb(0, 255, 157)';
                e.intensity = 1.0;
                e.isTagged = true;
            }
        });
    }

    update(dt) {
        // Keep tagged items lit
        this.dome.nodes.forEach(n => {
            if (n.isTagged) {
                n.pulseIntensity = 0.8 + 0.2 * Math.sin(performance.now() / 100); // Subtle strobe
            }
        });
    }
}
