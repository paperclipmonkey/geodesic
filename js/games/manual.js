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
        // Parse Color
        let r = 255, g = 255, b = 255;
        if (this.color.startsWith('#')) {
            const hex = this.color;
            r = parseInt(hex.slice(1, 3), 16);
            g = parseInt(hex.slice(3, 5), 16);
            b = parseInt(hex.slice(5, 7), 16);
        } else if (this.color.startsWith('rgb')) {
            const match = this.color.match(/\d+/g);
            if (match && match.length >= 3) {
                r = parseInt(match[0]);
                g = parseInt(match[1]);
                b = parseInt(match[2]);
            }
        }

        // Apply Intensity Scaling
        r = Math.floor(r * this.intensity);
        g = Math.floor(g * this.intensity);
        b = Math.floor(b * this.intensity);

        const fillStr = `rgb(${r},${g},${b})`;

        this.dome.nodes.forEach(n => {
            n.color = fillStr; // Keep for fallback?
            n.pulseIntensity = this.intensity;

            // Write to Hardware LEDs
            if (n.leds) {
                for (let i = 0; i < n.leds.length; i += 3) {
                    n.leds[i] = r;
                    n.leds[i + 1] = g;
                    n.leds[i + 2] = b;
                }
            }
        });

        this.dome.edges.forEach(e => {
            e.color = fillStr;
            e.intensity = this.intensity;

            // Write to Hardware LEDs
            if (e.pixelData) {
                for (let i = 0; i < e.pixelData.length; i += 3) {
                    e.pixelData[i] = r;
                    e.pixelData[i + 1] = g;
                    e.pixelData[i + 2] = b;
                }
            }
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
