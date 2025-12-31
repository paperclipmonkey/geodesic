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
            this.zoom = Math.min(Math.max(0.5, this.zoom), 10.0);
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

        // Draw Edges (Discrete LEDs)
        // We draw individual dots for each LED on the strut

        for (const e of this.dome.edges) {
            const nA = this.dome.nodes[e.a];
            const nB = this.dome.nodes[e.b];

            // Safety check for projection
            if (nA.sx === undefined || nB.sx === undefined) continue;

            // Check if we have pixel data initialized
            if (!e.pixelData || e.pixelData.length === 0) continue;

            // If the edge has a solid color override or intensity, we might want to fill the pixels
            // conceptually if the game logic hasn't updated them yet.
            // But ideally, the game logic updates pixelData.
            // For backward compatibility (breathing/manual), we can "fake" a fill here if pixelData is black
            // but edge.color or intensity is set.

            let useFallback = true;
            for (let i = 0; i < e.pixelData.length; i++) {
                if (e.pixelData[i] > 0) { useFallback = false; break; }
            }

            const ledCount = e.ledCount;
            const stepX = (nB.sx - nA.sx) / (ledCount + 1);
            const stepY = (nB.sy - nA.sy) / (ledCount + 1);

            // DYNAMIC SIZING: Ensure distinct dots by scaling radius to the gap distance
            const pixelStep = Math.hypot(stepX, stepY);

            // INCREASED SIZE: Use 40% of the step as radius (80% diameter), leaving only 20% gap
            // Minimum size upped with zoom factor
            const dotRadius = Math.max(1.5, pixelStep * 0.4);

            if (!window.rendererRadiusDebug) {
                console.log("Renderer Radius Debug:", {
                    pixelStep: pixelStep,
                    dotRadius: dotRadius,
                    zoom: this.zoom,
                    sampleStepX: stepX
                });
                window.rendererRadiusDebug = true;
            }

            this.ctx.shadowBlur = 0;

            for (let i = 0; i < ledCount; i++) {
                // Calculate position (screen space)
                // i=0 is first LED after nA
                const px = nA.sx + stepX * (i + 1);
                const py = nA.sy + stepY * (i + 1);

                let r, g, b;

                if (useFallback) {
                    // Start with base state
                    let active = false;
                    let cR = 0, cG = 0, cB = 0;

                    // 1. Check for Charge (Pulse Wars / Filling effect)
                    if (e.chargeRatio > 0 && e.chargeColor) {
                        // Determine if this specific LED pixel is within the "filled" portion
                        const isFromA = e.chargeSource === nA.id;
                        const pct = i / ledCount; // 0.0 to 1.0 (approx)

                        // Check threshold
                        if (isFromA) {
                            if (pct < e.chargeRatio) active = true;
                        } else {
                            if (pct > (1 - e.chargeRatio)) active = true;
                        }
                        // active flag will trigger color selection below
                    }

                    // 2. Check for Intensity / Solid Color
                    const opacity = e.intensity !== undefined ? e.intensity : 0.6;

                    if (active) {
                        // It is charged. 
                        // Force r,g,b to 255 to pass "isOff" check
                        r = 255; g = 255; b = 255;
                    } else {
                        // Base state
                        // Use a simple white * intensity
                        const val = Math.floor(255 * opacity);

                        if (e.color) {
                            // If edge has a static color (e.g. captured)
                            r = 255; g = 255; b = 255; // Placeholder
                        } else {
                            r = val; g = val; b = val;
                        }
                    }
                } else {
                    // Use Pixel Data
                    const pIdx = i * 3;
                    r = e.pixelData[pIdx];
                    g = e.pixelData[pIdx + 1];
                    b = e.pixelData[pIdx + 2];
                }

                // --- MODIFIED DRAWING LOGIC TO HANDLE FALLBACK STRINGS ---

                let isOff = false;
                if (!useFallback) {
                    if (r < 10 && g < 10 && b < 10) isOff = true;
                } else {
                    // Re-calculate isOff for fallback logic
                    const opacity = e.intensity !== undefined ? e.intensity : 0;
                    // Checking active state again is redundant but safe
                    // We simplified above by setting r,g,b=255 if active
                    if (r < 10 && !e.color) isOff = true;
                }

                if (isOff) {
                    // Draw faint dot for structural visibility
                    // VISIBILITY BOOST: Higher opacity and lighter grey
                    this.ctx.fillStyle = 'rgba(120, 120, 130, 0.8)';
                    this.ctx.beginPath();
                    this.ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
                    this.ctx.fill();
                    continue;
                }

                // Determine Fill Style
                if (useFallback) {
                    // Prioritize Charge -> Edge Color -> White
                    const opacity = e.intensity !== undefined ? e.intensity : 0.6;
                    let finalColor = `rgba(255,255,255,${opacity})`;

                    const hasCharge = (e.chargeRatio > 0 && e.chargeColor);
                    let pixelActive = false;
                    if (hasCharge) {
                        const isFromA = e.chargeSource === nA.id;
                        const pct = i / ledCount;
                        if (isFromA && pct < e.chargeRatio) pixelActive = true;
                        else if (!isFromA && pct > (1 - e.chargeRatio)) pixelActive = true;
                    }

                    if (pixelActive) finalColor = e.chargeColor;
                    else if (e.color) finalColor = e.color; // TODO: handle alpha?

                    this.ctx.fillStyle = finalColor;
                } else {
                    this.ctx.fillStyle = `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
                }

                // Glow?
                // If using fallback with charge, always glow
                if (useFallback && (e.chargeRatio > 0 || e.color)) {
                    this.ctx.shadowBlur = 5;
                    this.ctx.shadowColor = this.ctx.fillStyle;
                } else if (r > 100 || g > 100 || b > 100) {
                    this.ctx.shadowBlur = 4;
                    this.ctx.shadowColor = this.ctx.fillStyle;
                } else {
                    this.ctx.shadowBlur = 0;
                }

                this.ctx.beginPath();
                this.ctx.arc(px, py, dotRadius * 1.5, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        // Draw Nodes
        for (const n of this.dome.nodes) {
            // Reduced size by 40% (from 6 to 3.6 base) to reflect physical hubs better
            const radius = 3.6 * (n.scale / 100);

            // Glow
            if (n.pulseIntensity > 0 || n.capturedBy || n.owner || n.isTarget) {
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = this.getNodeColor(n, 1);
            } else {
                this.ctx.shadowBlur = 0;
            }

            this.ctx.fillStyle = this.getNodeColor(n, 1);
            this.ctx.beginPath();
            this.ctx.arc(n.sx, n.sy, Math.max(1.5, radius), 0, Math.PI * 2);
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
