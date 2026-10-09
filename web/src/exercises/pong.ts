import { Eye, EyeSlash } from "@phosphor-icons/react";
import { Exercise, rand } from "../exercise/Exercise";

/*
  Predictive pursuit: Pong against the computer. With the occluder on (O), the
  ball vanishes behind a band in the middle and you have to predict where it
  comes out. Port of eye_lab/exercises/pong.gd.
*/

const WIN_SCORE = 7;
const UP_KEYS = ["ArrowUp", "w", "W"];
const DOWN_KEYS = ["ArrowDown", "s", "S"];

export default class Pong extends Exercise {
  bx = 0;
  by = 0;
  vx = 0;
  vy = 0;
  playerY = 0;
  aiY = 0;
  score = [0, 0]; // [computer, player]
  hits = 0;
  misses = 0;
  occluder = true;
  serving = 0;
  // The shell only forwards keydown, so held keys are tracked here.
  held = new Set<string>();
  private onKeyUp = (e: KeyboardEvent) => this.held.delete(e.key);
  private onBlur = () => this.held.clear();

  setup() {
    this.id = "pong";
    this.title = "Predictive pursuit";
    this.steps = [
      "Your paddle is on the right. Move it with the mouse.",
      "Bounce the ball back past the computer.",
      "The grey band hides the ball, so predict where it comes out.",
      `First to ${WIN_SCORE} points wins.`,
    ];
    this.instructions = "You can switch the hiding band off with the button at the bottom.";
  }

  begin() {
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.playerY = this.height / 2;
    this.aiY = this.height / 2;
    this.updateToggle();
    this.serve(1);
  }

  dispose() {
    super.dispose();
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }

  updateToggle() {
    this.setAnswers(
      [{ id: "occluder", text: "Hiding band: " + (this.occluder ? "on" : "off"), icon: this.occluder ? EyeSlash : Eye }],
      { w: 190, h: 64 },
    );
  }

  onAnswer() {
    this.occluder = !this.occluder;
    this.updateToggle();
  }

  ballR() {
    return Math.min(16, Math.max(7, this.ppd() * 0.25));
  }

  paddleH() {
    return this.height * 0.14;
  }

  serve(towards: number) {
    this.bx = this.width / 2;
    this.by = this.height / 2;
    const ang = rand(-0.5, 0.5);
    const sp = this.width * 0.32;
    this.vx = towards * Math.cos(ang) * sp;
    this.vy = Math.sin(ang) * sp;
    this.serving = 0.8;
  }

  tick(dt: number) {
    if (UP_KEYS.some((k) => this.held.has(k))) this.playerY -= this.height * 1.2 * dt;
    if (DOWN_KEYS.some((k) => this.held.has(k))) this.playerY += this.height * 1.2 * dt;
    const ph = this.paddleH();
    this.playerY = Math.min(this.height - ph / 2, Math.max(ph / 2, this.playerY));

    // The computer tracks the ball with a capped speed, so it can be beaten.
    const targetY = this.vx < 0 ? this.by : this.height / 2;
    const step = this.height * 0.55 * dt;
    this.aiY += Math.max(-step, Math.min(step, targetY - this.aiY));

    if (this.serving > 0) {
      this.serving -= dt;
      return;
    }
    const r = this.ballR();
    this.bx += this.vx * dt;
    this.by += this.vy * dt;
    if (this.by < r || this.by > this.height - r) {
      this.vy = -this.vy;
      this.by = Math.min(this.height - r, Math.max(r, this.by));
    }

    const px = this.width - 40;
    const ax = 40;
    if (this.vx > 0 && this.bx + r >= px && this.bx < px + 10 && Math.abs(this.by - this.playerY) < ph / 2 + r) {
      this.hits++;
      this.bounce(this.playerY, -1);
    } else if (this.vx < 0 && this.bx - r <= ax && this.bx > ax - 10 && Math.abs(this.by - this.aiY) < ph / 2 + r) {
      this.bounce(this.aiY, 1);
    }

    if (this.bx > this.width + r) {
      this.misses++;
      this.score[0]++;
      this.feedback(false);
      this.afterPoint(-1);
    } else if (this.bx < -r) {
      this.score[1]++;
      this.feedback(true);
      this.afterPoint(1);
    }
  }

  bounce(paddleY: number, dir: number) {
    const off = Math.min(1, Math.max(-1, (this.by - paddleY) / (this.paddleH() / 2)));
    const speed = Math.hypot(this.vx, this.vy) * 1.05;
    this.vx = dir * Math.cos(off * 0.9) * speed;
    this.vy = Math.sin(off * 0.9) * speed;
  }

  afterPoint(towards: number) {
    this.setStatus(`You ${this.score[1]} - ${this.score[0]} Computer, ${this.hits} returns`);
    if (this.score[0] >= WIN_SCORE || this.score[1] >= WIN_SCORE) this.end();
    else this.serve(towards);
  }

  onPointer(p: { type: string; x: number; y: number }) {
    if (p.type === "move") this.playerY = p.y;
  }

  onKey(e: KeyboardEvent) {
    if (UP_KEYS.includes(e.key) || DOWN_KEYS.includes(e.key)) {
      this.held.add(e.key);
      return true;
    }
    if ((e.key === "o" || e.key === "O") && !e.repeat) {
      this.onAnswer();
      return true;
    }
    return false;
  }

  draw(g: CanvasRenderingContext2D) {
    const w = this.width;
    const h = this.height;
    g.fillStyle = "rgb(13, 13, 13)";
    g.fillRect(0, 0, w, h);
    if (!this.started || this.ended) return;
    g.fillStyle = "rgb(128, 128, 128)";
    for (let y = 0; y < Math.floor(h); y += 30) g.fillRect(w / 2 - 2, y, 4, 16);
    const ph = this.paddleH();
    g.fillStyle = "#ffffff";
    g.fillRect(w - 40, this.playerY - ph / 2, 10, ph);
    g.fillRect(30, this.aiY - ph / 2, 10, ph);
    const r = this.ballR();
    g.fillRect(this.bx - r, this.by - r, r * 2, r * 2);
    if (this.occluder) {
      g.fillStyle = "rgb(89, 89, 94)";
      g.fillRect(w * 0.4, 0, w * 0.2, h);
    }
    // Godot draws the string with its baseline at y = 130.
    g.fillStyle = "rgb(204, 204, 204)";
    g.font = `48px "Figtree Variable", system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillText(`${this.score[0]}        ${this.score[1]}`, w / 2, 130);
  }

  summary() {
    const total = this.hits + this.misses;
    if (total < 3) return { text: "Too short to score." };
    const rate = (100 * this.hits) / total;
    const verdict = this.score[1] > this.score[0] ? "You win!" : "Computer wins";
    return {
      value: rate,
      unit: "% returned",
      text: `${verdict}  (${this.score[1]} - ${this.score[0]})\nYou returned ${this.hits} of ${total} balls (${rate.toFixed(0)}%)${this.occluder ? " with the occluder on" : ""}.\n\nHigher is better.`,
      detail: { occluder: this.occluder },
    };
  }
}
