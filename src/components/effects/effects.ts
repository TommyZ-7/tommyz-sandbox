
export type EffectType = "Normal" | "Sparkle" | "Fire" | "Bubbles" | "Snow" | "Holiday" | "GeometricSnow" | "GiftBox";

/**
 * パーティクル基底クラス
 */
export abstract class Particle {
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
        this.size = Math.random() * 5 + 2;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.life = Math.random() * 50 + 50;
        this.initialLife = this.life;
        this.color = "#ffffff";
    }

    abstract update(): void;

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.initialLife);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0, this.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

export class NormalParticle extends Particle {
    constructor(x: number, y: number, magnitude: number) {
        super(x, y, magnitude);
        // 動きの大きさ（magnitude）に応じてサイズを変化させる
        // magnitudeは概ね 0 ~ 50 くらいの値を取ると想定
        const baseSize = Math.min(Math.max(magnitude / 2, 2), 15);
        this.size = Math.random() * 5 + baseSize;
        this.color = `hsl(${Math.random() * 360}, 100%, 70%)`;
        this.vx = (Math.random() - 0.5) * (magnitude / 2);
        this.vy = (Math.random() - 0.5) * (magnitude / 2);
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 1;
        this.size *= 0.98;
    }
}

export class SparkleParticle extends Particle {
    rotation: number;

    constructor(x: number, y: number, magnitude: number) {
        super(x, y, magnitude);
        const baseSize = Math.min(Math.max(magnitude / 3, 2), 10);
        this.size = Math.random() * 3 + baseSize;
        this.color = `hsl(50, 100%, ${50 + Math.random() * 50}%)`; // Gold/Yellow
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.rotation = Math.random() * Math.PI * 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 2; // Die faster
        this.rotation += 0.1;
        this.size *= 0.95;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.initialLife);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;

        // Draw star shape
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * this.size,
                Math.sin((18 + i * 72) * Math.PI / 180) * this.size);
            ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * (this.size / 2),
                Math.sin((54 + i * 72) * Math.PI / 180) * (this.size / 2));
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

export class FireParticle extends Particle {
    constructor(x: number, y: number, magnitude: number) {
        super(x, y, magnitude);
        const baseSize = Math.min(Math.max(magnitude / 2, 4), 20);
        this.size = Math.random() * 5 + baseSize;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = -Math.random() * 3 - 1; // Move upwards
        this.life = Math.random() * 30 + 30;
        this.initialLife = this.life;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 1;
        this.size *= 0.96;

        // Color shift from Yellow -> Red -> Smoke
        const progress = 1 - (this.life / this.initialLife);
        if (progress < 0.3) {
            this.color = `rgba(255, ${255 - progress * 500}, 0, ${this.life / this.initialLife})`;
        } else if (progress < 0.7) {
            this.color = `rgba(255, ${100 - (progress - 0.3) * 200}, 0, ${this.life / this.initialLife})`;
        } else {
            this.color = `rgba(100, 100, 100, ${this.life / this.initialLife})`;
        }
    }
}

export class BubbleParticle extends Particle {
    wobble: number;

    constructor(x: number, y: number, magnitude: number) {
        super(x, y, magnitude);
        const baseSize = Math.min(Math.max(magnitude / 2, 3), 15);
        this.size = Math.random() * 5 + baseSize;
        this.vx = (Math.random() - 0.5) * 1;
        this.vy = -Math.random() * 2 - 0.5; // Float upwards
        this.color = `hsla(${180 + Math.random() * 40}, 100%, 70%, 0.6)`; // Cyan/Blue
        this.wobble = Math.random() * Math.PI * 2;
    }

    update() {
        this.y += this.vy;
        this.x += Math.sin(this.wobble) * 0.5;
        this.wobble += 0.1;
        this.life -= 0.5;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.initialLife);
        ctx.strokeStyle = this.color;
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0, this.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Highlight
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.beginPath();
        ctx.arc(this.x - this.size * 0.3, this.y - this.size * 0.3, this.size * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

export class SnowParticle extends Particle {
    wobble: number;

    constructor(x: number, y: number, magnitude: number) {
        super(x, y, magnitude);
        const baseSize = Math.min(Math.max(magnitude / 3, 2), 8);
        this.size = Math.random() * 3 + baseSize;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = Math.random() * 2 + 1; // Fall downwards
        this.color = "rgba(255, 255, 255, 0.9)";
        this.wobble = Math.random() * Math.PI * 2;
        this.life = Math.random() * 60 + 60; // Longer life
        this.initialLife = this.life;
    }

    update() {
        this.x += this.vx + Math.sin(this.wobble) * 0.5;
        this.y += this.vy;
        this.wobble += 0.05;
        this.life -= 0.5;
        // Fade out size slightly
        if (this.life < 20) this.size *= 0.95;
    }
}

export class HolidayColorsParticle extends Particle {
    constructor(x: number, y: number, magnitude: number) {
        super(x, y, magnitude);
        const baseSize = Math.min(Math.max(magnitude / 2, 3), 12);
        this.size = Math.random() * 5 + baseSize;
        this.vx = (Math.random() - 0.5) * magnitude / 2;
        this.vy = (Math.random() - 0.5) * magnitude / 2;

        // Randomly pick Red, Green, Gold, or White
        const rand = Math.random();
        if (rand < 0.33) {
            this.color = `hsla(0, 100%, 50%, 0.8)`; // Red
        } else if (rand < 0.66) {
            this.color = `hsla(120, 100%, 35%, 0.8)`; // Green
        } else {
            this.color = `hsla(50, 100%, 50%, 0.8)`; // Gold
        }
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 1;
        this.size *= 0.97;
    }
}

export class ComplexSnowflakeParticle extends Particle {
    rotation: number;
    rotationSpeed: number;

    constructor(x: number, y: number, magnitude: number) {
        super(x, y, magnitude);
        const baseSize = Math.min(Math.max(magnitude / 2, 5), 20); // Slightly larger
        this.size = Math.random() * 5 + baseSize;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = Math.random() * 1.5 + 0.5;
        this.color = "rgba(220, 240, 255, 0.9)"; // Light blueish white
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.05;
        this.life = Math.random() * 60 + 60;
        this.initialLife = this.life;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;
        this.life -= 0.5;
        if (this.life < 30) this.size *= 0.98;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.initialLife);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2; // Thinner lines
        ctx.lineCap = "round";

        // Draw 6-sided snowflake
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -this.size);
            // Little branches
            ctx.moveTo(0, -this.size * 0.6);
            ctx.lineTo(-this.size * 0.3, -this.size * 0.8);
            ctx.moveTo(0, -this.size * 0.6);
            ctx.lineTo(this.size * 0.3, -this.size * 0.8);
            ctx.stroke();
            ctx.rotate(Math.PI / 3);
        }

        ctx.restore();
    }
}

export class GiftBoxParticle extends Particle {
    rotation: number;
    rotationSpeed: number;
    ribbonColor: string;

    constructor(x: number, y: number, magnitude: number) {
        super(x, y, magnitude);
        const baseSize = Math.min(Math.max(magnitude / 2, 6), 25);
        this.size = Math.random() * 8 + baseSize;
        this.vx = (Math.random() - 0.5) * 3;
        this.vy = -Math.random() * 4 - 2; // Shoot up like thrown gifts
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
        this.life = Math.random() * 50 + 50;
        this.initialLife = this.life;

        // Random Box Color (Red, Green, Blue)
        const rand = Math.random();
        if (rand < 0.33) this.color = "hsl(0, 80%, 60%)";
        else if (rand < 0.66) this.color = "hsl(120, 80%, 40%)";
        else this.color = "hsl(220, 80%, 60%)";

        this.ribbonColor = "hsl(45, 100%, 60%)"; // Gold ribbon
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // Gravity effect
        this.rotation += this.rotationSpeed;
        this.life -= 1;
        this.size *= 0.98;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.initialLife);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Box
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);

        // Ribbon (Vertical)
        ctx.fillStyle = this.ribbonColor;
        ctx.fillRect(-this.size / 6, -this.size / 2, this.size / 3, this.size);

        // Ribbon (Horizontal)
        ctx.fillRect(-this.size / 2, -this.size / 6, this.size, this.size / 3);

        ctx.restore();
    }
}
