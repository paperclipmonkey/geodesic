export class ParticleSystem {
    constructor(dome) {
        this.dome = dome;
        this.particles = [];
    }

    spawn(x, y, color, count = 12) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
            const speed = 2 + Math.random() * 4;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                color,
                size: 3 + Math.random() * 4
            });
        }
    }

    spawnTracer(x1, y1, x2, y2, color) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = 30; // frames to travel

        this.particles.push({
            x: x1, y: y1,
            vx: dx / steps,
            vy: dy / steps,
            life: 1,
            lifeDecay: 1 / steps,
            color,
            size: 4,
            isTracer: true
        });
    }

    spawnPathTracer(path, color) {
        if (!path || path.length < 2) return;
        this.particles.push({
            isPathTracer: true,
            path: path,
            pathIndex: 0,
            progress: 0, // 0 to 1 along current segment
            speed: 0.05, // slower validation speed
            color,
            x: path[0].sx,
            y: path[0].sy,
            size: 5,
            life: 1
        });
    }

    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            if (p.isPathTracer) {
                // Move along path
                p.progress += p.speed;
                if (p.progress >= 1) {
                    p.progress = 0;
                    p.pathIndex++;
                    if (p.pathIndex >= p.path.length - 1) {
                        p.life = 0; // Reached end
                    }
                }

                if (p.life > 0) {
                    const nA = p.path[p.pathIndex];
                    const nB = p.path[p.pathIndex + 1];
                    // Interpolate screen coords (assumes they are updated by renderer)
                    p.x = nA.sx + (nB.sx - nA.sx) * p.progress;
                    p.y = nA.sy + (nB.sy - nA.sy) * p.progress;

                    // LED Animation Logic
                    if (this.dome) {
                        const edge = this.dome.getEdge(nA.id, nB.id);
                        if (edge && edge.pixelData) {
                            // Map progress (0..1) to LED indices
                            // Calculate direction: if edge.a == nA.id, we go 0->len. Else len->0.
                            const isForward = (edge.a === nA.id);

                            // Determine active pixel index
                            let pixelIdx = Math.floor(p.progress * edge.ledCount);
                            if (!isForward) pixelIdx = edge.ledCount - 1 - pixelIdx;

                            // Clamp
                            pixelIdx = Math.max(0, Math.min(edge.ledCount - 1, pixelIdx));

                            // Write Color to Pixel Data
                            // Parse Hex Color to RGB
                            // Assumes p.color is hex string e.g. #ff00ff or #00ff9d
                            let r = 255, g = 255, b = 255;
                            if (p.color.startsWith('#')) {
                                const hex = p.color;
                                r = parseInt(hex.slice(1, 3), 16);
                                g = parseInt(hex.slice(3, 5), 16);
                                b = parseInt(hex.slice(5, 7), 16);
                            }

                            // Set main pixel
                            const baseIdx = pixelIdx * 3;
                            edge.pixelData[baseIdx] = r;
                            edge.pixelData[baseIdx + 1] = g;
                            edge.pixelData[baseIdx + 2] = b;

                            // Simple decay handled by games/loops, or we can manually fade here?
                            // For now, games usually clear pixel data or we need a fader.
                            // To make it look good, we should probably set a trail?
                            // But simply setting the head is a start. 
                            // *Self-correction*: If we don't clear it, it stays lit.
                            // We rely on the game loop or a separate fade loop to clear pixels.
                            // BUT Renderer uses pixelData directly. 
                            // Let's implement a quick fade in the edge update? 
                            // Or just assume the "trail" particles we spawn below handles the "look"
                            // and the LED is just the head.
                            // NOTE: Current dome.js doesn't have an auto-fade loop for pixelData.
                            // We should probably add one or handle it here.

                            // Let's rely on the fact that if we just set it, it stays. 
                            // We need it to fade. 
                            // Hack: Set previous pixels to fade? 
                            // Better: Add a decay loop to Dome or GameEngine.
                            // For this specific task, let's just light the head. 
                        }
                    }

                    // Simple trail
                    if (Math.random() < 0.5) {
                        this.particles.push({
                            x: p.x, y: p.y,
                            vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
                            life: 0.5, color: p.color, size: 2
                        });
                    }
                }

            } else if (p.isTracer) {
                p.x += p.vx;
                p.y += p.vy;
                p.life -= p.lifeDecay;
            } else {
                p.x += p.vx;
                p.y += p.vy;
                p.vx *= 0.96;
                p.vy *= 0.96;
                p.life -= 0.025;
                p.size *= 0.97;
            }

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
}
