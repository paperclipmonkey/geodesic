/**
 * 3D Dome Renderer
 * Handles HTML5 Canvas drawing, projection, and interaction.
 */

export class Renderer {
    constructor(canvas, dome, particleSystem) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d", { alpha: false });
        this.dome = dome;
        this.particleSystem = particleSystem;

        this.width = 0;
        this.height = 0;
        this.rx = 0.2; // Rotation X (Flatter view)
        this.ry = 0.5; // Rotation Y

        this.autoRotate = false;
        this.autoRotateEnabled = false; // User preference
        this.zoom = 1.3;

        this.setupResize();
        this.setupInput();
    }

    setupInput() {
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;

        // Zoom
        this.canvas.addEventListener('wheel', e => {
            e.preventDefault();
            this.zoom += e.deltaY * -0.002;
            this.zoom = Math.min(Math.max(0.5, this.zoom), 3.0);
        }, { passive: false });

        this.canvas.addEventListener('mousedown', e => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        window.addEventListener('mousemove', e => {
            if (!isDragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;

            this.ry -= dx * 0.01;
            this.rx -= dy * 0.01;

            lastX = e.clientX;
            lastY = e.clientY;

            // Disable auto rotate on interaction
            this.autoRotate = false;
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
            if (this.autoRotateEnabled) this.autoRotate = true;
        });

        // Touch support for rotation
        this.canvas.addEventListener('touchstart', e => {
            const t = e.touches[0];
            lastX = t.clientX;
            lastY = t.clientY;
        }, { passive: true });

        this.canvas.addEventListener('touchmove', e => {
            const t = e.touches[0];
            const dx = t.clientX - lastX;
            const dy = t.clientY - lastY;
            this.ry -= dx * 0.01;
            this.rx -= dy * 0.01;
            lastX = t.clientX;
            lastY = t.clientY;
            lastY = t.clientY;
            this.autoRotate = false;
        }, { passive: true });

        this.canvas.addEventListener('touchend', () => {
            if (this.autoRotateEnabled) this.autoRotate = true;
        });
    }

    setupResize() {
        window.addEventListener('resize', () => this.resize());
        this.resize();
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.width = rect.width;
        this.height = rect.height;

        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;

        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    project(p) {
        // Rotate Y
        let x = p[0], y = p[1], z = p[2];
        let c = Math.cos(this.rx), s = Math.sin(this.rx);
        let x1 = x * c - z * s;
        let z1 = x * s + z * c;

        // Rotate X
        c = Math.cos(this.ry); s = Math.sin(this.ry);
        let y2 = y * c - z1 * s;
        let z2 = y * s + z1 * c;

        // Perspective
        const scale = (300 * this.zoom) / (4 - z2);
        const cx = this.width / 2;
        const cy = this.height / 2;

        return {
            x: cx + x1 * scale,
            y: cy + y2 * scale,
            scale: scale,
            z: z2 // depth for sorting if needed
        };
    }

    draw(participants, particles) {
        // Clear
        this.ctx.fillStyle = '#050608'; // Matches CSS var(--bg)
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.autoRotate) {
            this.rx += 0.004;
        }

        // Update Projections
        for (const n of this.dome.nodes) {
            const p = this.project(n.p3);
            n.sx = p.x;
            n.sy = p.y;
            n.scale = p.scale;
        }

        // Draw Edges
        this.ctx.lineWidth = 3.0; // Increased base width for visibility
        for (const e of this.dome.edges) {
            const nA = this.dome.nodes[e.a];
            const nB = this.dome.nodes[e.b];

            // Calculate Edge Style
            let edgeColor = e.color;
            let edgeOpacity = 0.6; // Increased base opacity
            let lineWidth = 3.0;   // Thicker default

            // Gradient stroke
            const grad = this.ctx.createLinearGradient(nA.sx, nA.sy, nB.sx, nB.sy);

            // Check for custom edge color
            if (e.color) {
                edgeColor = e.color;
                edgeOpacity = (e.intensity !== undefined) ? e.intensity : 1.0;
                lineWidth = 4.0; // Even thicker for active
            }

            // Check for charged strut (Edge property)
            if (e.chargeRatio > 0 && e.chargeColor) {
                // Fill from A to B (or B to A? We need direction)
                // Assuming 'chargeFrom' is set on edge to know direction, or just generic fill
                // For simplified visuals, let's assume A->B fill for now or gradients
                // Actually, gradients are absolute. 
                // If we want to animate "filling", we need to know which node is "source".
                // Let's assume the game sets 'chargeSource' on the edge to 'nA' or 'nB' ID.

                const isFromA = e.chargeSource === nA.id;
                const ratio = isFromA ? e.chargeRatio : (1 - e.chargeRatio);

                // Base color
                const cA = this.getNodeColor(nA, 0.4);
                const cB = this.getNodeColor(nB, 0.4);

                if (isFromA) {
                    grad.addColorStop(0, e.chargeColor);
                    grad.addColorStop(ratio, e.chargeColor);
                    grad.addColorStop(ratio + 0.01, cB); // Hard transition
                    grad.addColorStop(1, cB);
                } else {
                    grad.addColorStop(0, cA);
                    grad.addColorStop(ratio - 0.01, cA);
                    grad.addColorStop(ratio, e.chargeColor);
                    grad.addColorStop(1, e.chargeColor);
                }

                this.ctx.lineWidth = 5; // Thicker for active strut
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = e.chargeColor;

            } else {
                if (e.color) {
                    grad.addColorStop(0, edgeColor);
                    grad.addColorStop(1, edgeColor);
                } else {
                    grad.addColorStop(0, this.getNodeColor(nA, edgeOpacity));
                    grad.addColorStop(1, this.getNodeColor(nB, edgeOpacity));
                }
                this.ctx.lineWidth = lineWidth;
                this.ctx.shadowBlur = 0;
            }

            this.ctx.globalAlpha = edgeOpacity;
            this.ctx.strokeStyle = grad;
            this.ctx.beginPath();
            this.ctx.moveTo(nA.sx, nA.sy);
            this.ctx.lineTo(nB.sx, nB.sy);
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
            this.ctx.shadowBlur = 0;
        }

        // Draw Nodes
        for (const n of this.dome.nodes) {
            const radius = 6 * (n.scale / 100);

            // Glow
            if (n.pulseIntensity > 0 || n.capturedBy || n.owner || n.isTarget) {
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = this.getNodeColor(n, 1);
            } else {
                this.ctx.shadowBlur = 0;
            }

            this.ctx.fillStyle = this.getNodeColor(n, 1);
            this.ctx.beginPath();
            this.ctx.arc(n.sx, n.sy, Math.max(2, radius), 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // Ring Charge (Pulse Wars)
            if (n.ringCharge > 0) {
                const pct = n.ringCharge / 12; // 12 LEDs
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(n.sx, n.sy, Math.max(4, radius + 3), 0, Math.PI * 2 * pct);
                this.ctx.stroke();
            }
        }

        // Draw Particles
        if (this.particleSystem) {
            for (const p of this.particleSystem.particles) {
                this.ctx.fillStyle = p.color;
                this.ctx.globalAlpha = p.life;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.globalAlpha = 1;
            }
        }
    }

    getNodeColor(n, alpha = 1) {
        let color = n.color;

        // Default if no color set
        if (!color) {
            if (n.capturedBy === 1) color = 'rgb(255, 0, 85)';
            else if (n.capturedBy === 2) color = 'rgb(59, 130, 246)';
            else if (n.owner === 1) color = 'rgb(255, 0, 85)';
            else if (n.owner === 2) color = 'rgb(59, 130, 246)';
            else if (n.chainLit) color = 'rgb(0, 255, 157)';
            else if (n.pulseIntensity > 0) return `rgba(255, 255, 255, ${alpha})`;
            else return `rgba(30, 36, 51, ${alpha})`;
        }

        // Handle alpha injection
        if (alpha !== 1) {
            if (color.startsWith('rgb(')) {
                return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
            } else if (color.startsWith('hsl(')) {
                // Convert hsl(h, s%, l%) to hsla(h, s%, l%, alpha)
                // Or just use new CSS syntax if supported, but safer to replace.
                return color.replace('hsl', 'hsla').replace(')', `, ${alpha})`);
            } else if (color.startsWith('#')) {
                // Hex to rgba? Or just use hex if alpha is 1.
                // For simplicity, if it's hex and we need alpha, we might need a helper, 
                // but let's assume we stick to rgb/hsl for dynamic stuff.
                // If it is hex, we can't easily add alpha without parsing.
                // Let's assume hex is opaque.
            }
        }

        return color;
    }

    // Interaction
    getNodeAt(x, y) {
        // Simple hit testing
        // Since we are 2D projected, we check distance to screen coords
        // Sort by Z to click front nodes first? 
        // For simplicity, just find closest within threshold

        let closest = null;
        let dist = Infinity;

        for (const n of this.dome.nodes) {
            const dx = n.sx - x;
            const dy = n.sy - y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 20 && d < dist) { // 20px hit radius
                closest = n;
                dist = d;
            }
        }
        return closest;
    }
}
