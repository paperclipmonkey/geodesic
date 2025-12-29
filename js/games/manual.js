export class ManualGame {
    constructor(dome, ui) {
        this.dome = dome;
        this.ui = ui;
        this.active = false;
        this.color = 'rgb(255, 255, 255)';
        this.intensity = 0.5;
    }

    start() {
        this.active = true;
        this.ui.updateStatus("Mode: Manual Control");
        this.apply();
    }

    stop() {
        this.active = false;
        this.dome.nodes.forEach(n => { n.color = null; n.pulseIntensity = 0; });
        this.dome.edges.forEach(e => { e.color = null; e.intensity = 0; });
    }

    update(dt) {
        if (!this.active) return;
        this.apply();
    }

    apply() {
        this.dome.nodes.forEach(n => {
            // Apply intensity as alpha to the RGB color
            if (this.color.startsWith('rgb(')) {
                n.color = this.color.replace('rgb', 'rgba').replace(')', `, ${this.intensity})`);
            } else {
                n.color = this.color;
            }
            n.pulseIntensity = this.intensity;
        });
        this.dome.edges.forEach(e => {
            e.color = this.color;
            e.intensity = this.intensity;
        });
    }

    setColor(r, g, b) {
        this.color = `rgb(${r}, ${g}, ${b})`;
    }

    setIntensity(val) {
        this.intensity = val;
    }

    onInteract(node) {
        // No interaction needed for manual mode
    }
}
