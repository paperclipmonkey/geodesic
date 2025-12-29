export class ResonanceGame {
    constructor(dome, ui) {
        this.dome = dome;
        this.ui = ui;
        this.active = false;
        this.waves = [];
        this.score = 0;
    }

    start() {
        this.active = true;
        this.waves = [];
        this.score = 0;
        this.ui.updateStatus("Resonance: Create waves!");
    }

    stop() {
        this.active = false;
        this.waves = [];
    }

    update(dt) {
        if (!this.active) return;

        // Propagate Waves
        // Simple physics: wave spreads from center
        // Since this is discrete graph, we use neighbor propagation or distance check

        // Let's use the visual distance for smooth effect
        for (let i = this.waves.length - 1; i >= 0; i--) {
            const w = this.waves[i];
            w.radius += dt * 5; // Expansion speed
            w.intensity -= dt * 0.5; // Fade

            if (w.intensity <= 0) {
                this.waves.splice(i, 1);
            }
        }

        // Apply to nodes
        for (const n of this.dome.nodes) {
            n.pulseIntensity = 0; // reset
            const p = n.p3; // [x,y,z] unit

            let totalEnergy = 0;

            for (const w of this.waves) {
                // Distance on sphere surface is arc length, but straight line dist is close enough for small r
                const dist = Math.sqrt(
                    (p[0] - w.origin[0]) ** 2 +
                    (p[1] - w.origin[1]) ** 2 +
                    (p[2] - w.origin[2]) ** 2
                );

                // Band width
                const diff = Math.abs(dist - w.radius);
                if (diff < 0.3) {
                    totalEnergy += w.intensity * (1 - diff / 0.3);
                }
            }

            n.pulseIntensity = Math.min(1, totalEnergy);
        }
    }

    onInteract(node) {
        if (!this.active) return;

        // Spawn wave
        this.waves.push({
            origin: node.p3,
            radius: 0,
            intensity: 1.0,
            owner: 0 // neutral
        });

        // Trigger sound via event?
    }
}
