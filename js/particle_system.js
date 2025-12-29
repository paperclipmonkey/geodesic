export class ParticleSystem {
    constructor() {
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
