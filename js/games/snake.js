export class SnakeGame {
    constructor(dome, ui) {
        this.dome = dome;
        this.ui = ui;
        this.active = false;
        this.snake = []; // Array of node IDs
        this.direction = null; // Next node ID
        this.moveTimer = 0;
        this.moveDelay = 0.3;
        this.targetNode = null;
        this.score = 0;
        this.snakeColor = { r: 0, g: 255, b: 157 };
        this.targetColor = 'rgb(255, 255, 255)';
        this.trail = []; // Stores node objects with decay
    }

    start() {
        this.active = true;
        this.score = 0;
        this.snake = [Math.floor(Math.random() * this.dome.nodes.length)];
        this.spawnTarget();
        this.ui.updateStatus("Snake: Eat the lights!");
        this.ui.updateScore({ label: "Length", p1: this.snake.length });
    }

    stop() {
        this.active = false;
        this.dome.nodes.forEach(n => { n.color = null; n.isTarget = false; n.pulseIntensity = 0; });
        this.dome.edges.forEach(e => { e.color = null; e.intensity = 0; });
    }

    spawnTarget() {
        // Safety check: is the snake filling the dome?
        if (this.snake.length >= this.dome.nodes.length) {
            this.gameOver(true);
            return;
        }

        let potential;
        // Optimization: if snake is huge, finding a random empty spot by guessing is slow.
        // But for <100 nodes, it's fine. 
        // Just add a safety break.
        let attempts = 0;
        const maxAttempts = 500;

        do {
            potential = Math.floor(Math.random() * this.dome.nodes.length);
            attempts++;
            if (attempts > maxAttempts) {
                // Fallback: Linear search for empty spot
                const emptySpots = this.dome.nodes
                    .map(n => n.id)
                    .filter(id => !this.snake.includes(id));

                if (emptySpots.length === 0) {
                    this.gameOver(true);
                    return;
                }
                potential = emptySpots[Math.floor(Math.random() * emptySpots.length)];
                break;
            }
        } while (this.snake.includes(potential));

        if (this.targetNode) this.targetNode.isTarget = false;
        this.targetNode = this.dome.nodes[potential];
        this.targetNode.isTarget = true;
    }

    gameOver(win) {
        this.active = false;
        this.ui.showNotification(win ? "PERFECT SNAKE!" : "GAME OVER", win ? "success" : "info");

        setTimeout(() => {
            if (this.ui) this.ui.showNotification("Restarting...", "info");
            this.stop();
            this.start();
        }, 3000);
    }

    update(dt) {
        if (!this.active) return;

        this.moveTimer += dt;
        if (this.moveTimer >= this.moveDelay) {
            this.moveTimer = 0;
            this.move();
        }

        // Visuals
        this.dome.nodes.forEach(n => {
            const index = this.snake.indexOf(n.id);
            if (index !== -1) {
                // Decay color from head to tail
                const factor = 1 - (index / this.snake.length);
                const r = Math.floor(this.snakeColor.r * factor);
                const g = Math.floor(this.snakeColor.g * factor);
                const b = Math.floor(this.snakeColor.b * factor);
                n.color = `rgb(${r}, ${g}, ${b})`;
                n.pulseIntensity = factor;
            } else if (n.isTarget) {
                n.color = this.targetColor;
                n.pulseIntensity = 0.5 + 0.5 * Math.sin(performance.now() / 200);
            } else {
                n.color = null;
                n.pulseIntensity = 0;
            }
        });

        // Light up edges between snake segments
        this.dome.edges.forEach(e => {
            let edgeIndex = -1;
            for (let i = 0; i < this.snake.length - 1; i++) {
                if ((e.a === this.snake[i] && e.b === this.snake[i + 1]) ||
                    (e.a === this.snake[i + 1] && e.b === this.snake[i])) {
                    edgeIndex = i;
                    break;
                }
            }
            if (edgeIndex !== -1) {
                const factor = 1 - (edgeIndex / this.snake.length);
                const r = Math.floor(this.snakeColor.r * factor);
                const g = Math.floor(this.snakeColor.g * factor);
                const b = Math.floor(this.snakeColor.b * factor);
                e.color = `rgb(${r}, ${g}, ${b})`;
                e.intensity = factor;
            } else {
                e.color = null;
                e.intensity = 0;
            }
        });
    }

    move() {
        const headId = this.snake[0];
        const neighbors = this.dome.adj[headId];

        // Find path towards target
        const path = this.dome.findPath(headId, this.targetNode.id);
        let nextId;

        if (path && path.length > 1) {
            nextId = path[1].id;
        } else {
            // Random move if no path or at target (spawnTarget ensures target is not head)
            nextId = neighbors[Math.floor(Math.random() * neighbors.length)];
        }

        // Check if eating target
        if (nextId === this.targetNode.id) {
            this.snake.unshift(nextId);
            this.spawnTarget();
            this.score++;
            this.ui.updateScore({ label: "Length", p1: this.snake.length });
            this.moveDelay = Math.max(0.1, 0.3 - (this.snake.length * 0.01));
        } else {
            this.snake.unshift(nextId);
            this.snake.pop();
        }

        // Self collision? (Optional for this "cool animation" version)
        // If we want it to be a game, we'd check if snake[1:] includes nextId.
    }

    onInteract(node) {
        // Change snake color or something?
    }
}
