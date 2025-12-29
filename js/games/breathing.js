export class BreathingGame {
    constructor(dome, ui) {
        this.dome = dome;
        this.ui = ui;
        this.active = false;
        this.time = 0;
        this.color = 'rgb(255, 255, 255)';
        this.speed = 1.0;
    }

    start() {
        this.active = true;
        this.time = 0;
        this.ui.updateStatus("Mode: Breathing");
    }

    stop() {
        this.active = false;
        // Reset dome colors
        this.dome.nodes.forEach(n => n.color = null);
        this.dome.edges.forEach(e => { e.color = null; e.intensity = 0; });
    }

    update(dt) {
        if (!this.active) return;

        this.time += dt * this.speed;

        // Pulse between 0.2 and 1.0 with smoother easing (sine squared for more "breathing" feel)
        const intensity = 0.2 + 0.8 * Math.pow(Math.sin(this.time * 0.5), 2);

        // Color cycling (subtle hue shift)
        const hue = (this.time * 10) % 360;
        const color = `hsl(${hue}, 70%, 60%)`;

        this.dome.nodes.forEach(n => {
            n.color = color;
            n.pulseIntensity = intensity;
        });

        this.dome.edges.forEach(e => {
            e.color = color;
            e.intensity = intensity;
        });
    }

    onInteract(node) {
        // Maybe change color on interact?
        const colors = [
            'rgb(255, 255, 255)',
            'rgb(255, 0, 85)',
            'rgb(59, 130, 246)',
            'rgb(0, 255, 157)',
            'rgb(255, 170, 0)'
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];
    }
}
