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

    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.96;
            p.vy *= 0.96;
            p.life -= 0.025;
            p.size *= 0.97;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
}
