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

        // Pulse between 0.2 and 1.0
        const intensity = 0.2 + 0.8 * Math.pow(Math.sin(this.time * 0.5), 2);

        // Color cycling (subtle hue shift)
        const hue = (this.time * 10) % 360;

        // Convert HSL to RGB
        const s = 0.7; // 70%
        const l = 0.6; // 60%

        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
        const m = l - c / 2;

        let r = 0, g = 0, b = 0;
        if (0 <= hue && hue < 60) { r = c; g = x; b = 0; }
        else if (60 <= hue && hue < 120) { r = x; g = c; b = 0; }
        else if (120 <= hue && hue < 180) { r = 0; g = c; b = x; }
        else if (180 <= hue && hue < 240) { r = 0; g = x; b = c; }
        else if (240 <= hue && hue < 300) { r = x; g = 0; b = c; }
        else if (300 <= hue && hue < 360) { r = c; g = 0; b = x; }

        r = Math.floor((r + m) * 255);
        g = Math.floor((g + m) * 255);
        b = Math.floor((b + m) * 255);

        // Apply Intensity
        const ir = Math.floor(r * intensity);
        const ig = Math.floor(g * intensity);
        const ib = Math.floor(b * intensity);

        const rgbStr = `rgb(${ir},${ig},${ib})`; // use scaled for fallback

        this.dome.nodes.forEach(n => {
            n.color = rgbStr;
            n.pulseIntensity = intensity;

            // Hardware LEDs
            if (n.leds) {
                for (let i = 0; i < n.leds.length; i += 3) {
                    n.leds[i] = ir;
                    n.leds[i + 1] = ig;
                    n.leds[i + 2] = ib;
                }
            }
        });

        this.dome.edges.forEach(e => {
            e.color = rgbStr;
            e.intensity = intensity;

            // Hardware LEDs
            if (e.pixelData) {
                for (let i = 0; i < e.pixelData.length; i += 3) {
                    e.pixelData[i] = ir;
                    e.pixelData[i + 1] = ig;
                    e.pixelData[i + 2] = ib;
                }
            }
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
