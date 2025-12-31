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

        // 1. Propagate Waves
        // Slower expansion
        for (let i = this.waves.length - 1; i >= 0; i--) {
            const w = this.waves[i];
            w.radius += dt * 1.5; // Slower speed (was 5)
            w.intensity -= dt * 0.3; // Slower fade to match

            if (w.intensity <= 0) {
                this.waves.splice(i, 1);
            }
        }

        // 2. Clear State
        this.dome.nodes.forEach(n => {
            n.pulseIntensity = 0;
            n.color = null;
            n.capturedBy = null; // Ensure no override
        });
        this.dome.edges.forEach(e => {
            e.intensity = 0;
            e.color = null;
            if (e.pixelData) e.pixelData.fill(0); // Clear HW LEDs
        });

        // Helper to add wave contribution
        const accumulateWave = (item, dist) => {
            let r = 0, g = 0, b = 0;
            let totalInt = 0;

            for (const w of this.waves) {
                // Band width logic
                const diff = Math.abs(dist - w.radius);
                const width = 0.5; // Wider band for slower feel

                if (diff < width) {
                    const signal = w.intensity * (1 - diff / width);
                    if (signal > 0) {
                        // Additive Color Blending
                        r += w.color[0] * signal;
                        g += w.color[1] * signal;
                        b += w.color[2] * signal;
                        totalInt += signal;
                    }
                }
            }

            if (totalInt > 0.01) {
                // Clamp RGB
                r = Math.min(255, Math.floor(r));
                g = Math.min(255, Math.floor(g));
                b = Math.min(255, Math.floor(b));

                // Apply to Item
                item.color = `rgb(${r},${g},${b})`;
                item.pulseIntensity = Math.min(1, totalInt);

                // For edges, property is just 'intensity'
                if (item.a !== undefined) item.intensity = Math.min(1, totalInt);

                // Hardware LED Sync for Edges
                if (item.pixelData) {
                    // Fill whole strut with this color
                    // (To make it fancy later, we could gradient the strut based on precise distance)
                    for (let k = 0; k < item.pixelData.length; k += 3) {
                        item.pixelData[k] = r;
                        item.pixelData[k + 1] = g;
                        item.pixelData[k + 2] = b;
                    }
                }
            }
        };

        // 3. Apply to Nodes
        for (const n of this.dome.nodes) {
            let totalDist = 0; // Optimization: calc dist once per wave? No, simple loop.
            // We need dist from node to wave origin
            // To optimize, we could do 1 pass.
            // But simpler to just pass the calc function or do it inline.

            // We need to pass the custom dist per wave
            // Refactoring helper to loop inside loop

            let r = 0, g = 0, b = 0;
            let active = false;

            for (const w of this.waves) {
                const dist = Math.sqrt(
                    (n.p3[0] - w.origin[0]) ** 2 + (n.p3[1] - w.origin[1]) ** 2 + (n.p3[2] - w.origin[2]) ** 2
                );
                const diff = Math.abs(dist - w.radius);
                if (diff < 0.6) {
                    const signal = w.intensity * (1 - diff / 0.6);
                    if (signal > 0.01) {
                        r += w.color[0] * signal;
                        g += w.color[1] * signal;
                        b += w.color[2] * signal;
                        active = true;
                    }
                }
            }

            if (active) {
                r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
                n.color = `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
                n.pulseIntensity = 1; // Renderer uses this to glow
            }
        }

        // 4. Apply to Edges
        for (const e of this.dome.edges) {
            const nA = this.dome.nodes[e.a];
            const nB = this.dome.nodes[e.b];

            // We want per-pixel flow calculation
            if (!e.pixelData) continue;

            let maxR = 0, maxG = 0, maxB = 0; // For fallback line color
            let activeEdge = false;

            const count = e.ledCount;
            for (let k = 0; k < count; k++) {
                // Interpolate Position
                const t = k / (count - 1);
                const px = nA.p3[0] + (nB.p3[0] - nA.p3[0]) * t;
                const py = nA.p3[1] + (nB.p3[1] - nA.p3[1]) * t;
                const pz = nA.p3[2] + (nB.p3[2] - nA.p3[2]) * t;

                let r = 0, g = 0, b = 0;
                let totalInt = 0;

                for (const w of this.waves) {
                    // Dist from wave origin to this PIXEL
                    const dist = Math.sqrt(
                        (px - w.origin[0]) ** 2 + (py - w.origin[1]) ** 2 + (pz - w.origin[2]) ** 2
                    );

                    const diff = Math.abs(dist - w.radius);
                    // Slightly narrower band for strut LEDs to look crisp
                    if (diff < 0.5) {
                        const signal = w.intensity * (1 - diff / 0.5);
                        if (signal > 0) {
                            r += w.color[0] * signal;
                            g += w.color[1] * signal;
                            b += w.color[2] * signal;
                            totalInt += signal;
                        }
                    }
                }

                if (totalInt > 0.01) {
                    activeEdge = true;
                    r = Math.min(255, Math.floor(r));
                    g = Math.min(255, Math.floor(g));
                    b = Math.min(255, Math.floor(b));

                    // Update Edge Max for fallback line
                    maxR = Math.max(maxR, r);
                    maxG = Math.max(maxG, g);
                    maxB = Math.max(maxB, b);

                    // Set Pixel
                    const idx = k * 3;
                    e.pixelData[idx] = r;
                    e.pixelData[idx + 1] = g;
                    e.pixelData[idx + 2] = b;
                }
            }

            if (activeEdge) {
                e.color = `rgb(${maxR},${maxG},${maxB})`;
                e.intensity = 1; // Renderer will draw dots if pixelData is set
            }
        }
    }

    onInteract(node) {
        if (!this.active) return;

        // Random HSL to RGB
        const hue = Math.random();
        const saturation = 0.8 + Math.random() * 0.2;
        const value = 0.8 + Math.random() * 0.2;

        // Simple HSL2RGB helper
        const h = hue, s = saturation, v = value;
        let r, g, b;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }

        const col = [r * 255, g * 255, b * 255];

        // Spawn wave
        this.waves.push({
            origin: node.p3,
            radius: 0,
            intensity: 1.0,
            color: col,
            owner: 0
        });

        this.ui.updateStatus(`Resonance: Wave Spawned (${Math.floor(hue * 360)}°)`);
    }
}
