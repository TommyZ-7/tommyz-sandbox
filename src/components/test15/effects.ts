export type EffectType = "sparkle" | "ripple" | "fire";

export interface EffectParticle {
    update(): void;
    draw(ctx: CanvasRenderingContext2D): void;
    isDead(): boolean;
}

export class SparkleParticle implements EffectParticle {
    x: number;
    y: number;
    size: number;
    vx: number;
    vy: number;
    life: number;
    initialLife: number;
    color: string;

    constructor(x: number, y: number, magnitude: number) {
        this.x = x;
        this.y = y;
        // Magnitude affects size and speed
        const baseSize = 2;
        const sizeMultiplier = Math.min(magnitude / 5, 3); // Cap multiplier
        this.size = Math.random() * 5 + baseSize + sizeMultiplier * 2;

        const speedMultiplier = Math.min(magnitude / 5, 2);
        this.vx = (Math.random() - 0.5) * (4 + speedMultiplier * 2);
        this.vy = (Math.random() - 0.5) * (4 + speedMultiplier * 2);

        this.life = Math.random() * 30 + 30;
        this.initialLife = this.life;
        this.color = `hsl(${Math.random() * 60 + 40}, 100%, 70%)`; // Yellow/Goldish
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 1;
        this.size *= 0.95;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.initialLife);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0, this.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

export class RippleParticle implements EffectParticle {
    x: number;
    y: number;
    size: number;
    maxSize: number;
    life: number;
    initialLife: number;
    color: string;

    constructor(x: number, y: number, magnitude: number) {
        this.x = x;
        this.y = y;
        this.size = 1;
        // Magnitude affects max size
        this.maxSize = 20 + Math.min(magnitude * 2, 50);
        this.life = 30;
        this.initialLife = this.life;
        this.color = `hsl(${Math.random() * 40 + 180}, 100%, 70%)`; // Cyan/Blue
    }

    update() {
        this.size += (this.maxSize - this.size) * 0.1;
        this.life -= 1;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.initialLife);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

export class FireParticle implements EffectParticle {
    x: number;
    y: number;
    size: number;
    vx: number;
    vy: number;
    life: number;
    initialLife: number;
    color: string;

    constructor(x: number, y: number, magnitude: number) {
        this.x = x;
        this.y = y;
        // Magnitude affects size and upward speed
        const sizeMultiplier = Math.min(magnitude / 5, 2);
        this.size = Math.random() * 5 + 5 + sizeMultiplier * 3;

        this.vx = (Math.random() - 0.5) * 2;
        this.vy = -Math.random() * 3 - 2 - Math.min(magnitude / 2, 5); // Move up faster with magnitude

        this.life = Math.random() * 20 + 20;
        this.initialLife = this.life;
        // Red/Orange/Yellow
        const hue = Math.random() * 40; // 0-40
        this.color = `hsl(${hue}, 100%, 60%)`;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.size *= 0.92;
        this.life -= 1;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.initialLife);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0, this.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

export const createParticles = (
    type: EffectType,
    x: number,
    y: number,
    magnitude: number
): EffectParticle[] => {
    const particles: EffectParticle[] = [];
    const count = type === "ripple" ? 1 : 5 + Math.floor(magnitude); // More particles for higher magnitude

    for (let i = 0; i < count; i++) {
        switch (type) {
            case "sparkle":
                particles.push(new SparkleParticle(x, y, magnitude));
                break;
            case "ripple":
                particles.push(new RippleParticle(x, y, magnitude));
                break;
            case "fire":
                particles.push(new FireParticle(x, y, magnitude));
                break;
        }
    }
    return particles;
};
