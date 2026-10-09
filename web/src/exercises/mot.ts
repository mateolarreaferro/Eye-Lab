import { Exercise, rand } from "../exercise/Exercise";
import { circle, ring } from "../exercise/draw";
import { Staircase } from "../lib/staircase";

/*
  Multiple object tracking across the whole screen (objects can go into the
  periphery). Some dots are cued red, then all move; click the cued ones.
  Speed adapts. Port of eye_lab/exercises/mot.gd.
*/

const TRIALS = 12;
const N_DOTS = 10;
const N_TARGETS = 4;

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  target: boolean;
  picked: boolean;
}

export default class Mot extends Exercise {
  // Speed in deg/s; larger is harder.
  stair = new Staircase(5.0, 1.0, 40.0, 1.3, false);
  trial = 0;
  dots: Dot[] = [];
  phase: "idle" | "cue" | "track" | "respond" | "feedback" = "idle";
  phaseT = 0;

  setup() {
    this.id = "mot";
    this.title = "Multiple object tracking";
    this.steps = [
      `${N_TARGETS} dots get a red ring. Remember them.`,
      "The rings vanish and all the dots move around.",
      `When they stop, tap the ${N_TARGETS} dots you remember.`,
      "They speed up as you improve.",
    ];
    this.instructions = "";
  }

  begin() {
    this.next();
  }

  r() {
    return Math.min(22, Math.max(10, this.ppd() * 0.35));
  }

  next() {
    this.trial++;
    if (this.trial > TRIALS) {
      this.end();
      return;
    }
    this.dots = [];
    const r = this.r();
    while (this.dots.length < N_DOTS) {
      const x = rand(r * 3, this.width - r * 3);
      const y = rand(r * 3 + 70, this.height - r * 3 - 60);
      if (this.dots.some((d) => Math.hypot(x - d.x, y - d.y) < r * 5)) continue;
      const a = Math.random() * Math.PI * 2;
      this.dots.push({ x, y, vx: Math.cos(a), vy: Math.sin(a), target: this.dots.length < N_TARGETS, picked: false });
    }
    this.phase = "cue";
    this.phaseT = 2.0;
    this.setStatus(`Round ${this.trial} of ${TRIALS}, speed ${this.stair.value.toFixed(1)}°/s`);
  }

  tick(dt: number) {
    if (this.phase === "cue") {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        this.phase = "track";
        this.phaseT = 6.0;
      }
    } else if (this.phase === "track") {
      this.phaseT -= dt;
      this.move(dt);
      if (this.phaseT <= 0) {
        this.phase = "respond";
        this.setStatus(`Click the ${N_TARGETS} marked dots`);
      }
    }
  }

  move(dt: number) {
    const r = this.r();
    const speed = this.stair.value * this.ppd();
    const lo = [r, r + 70];
    const hi = [this.width - r, this.height - (r + 60)];
    for (const d of this.dots) {
      // Random heading drift, then bounce off the edges.
      const turn = rand(-1.5, 1.5) * dt;
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      let vx = d.vx * c - d.vy * s;
      let vy = d.vx * s + d.vy * c;
      const len = Math.hypot(vx, vy) || 1;
      vx /= len;
      vy /= len;
      const px = d.x + vx * speed * dt;
      const py = d.y + vy * speed * dt;
      if (px < lo[0] || px > hi[0]) vx = -vx;
      if (py < lo[1] || py > hi[1]) vy = -vy;
      d.x = Math.min(hi[0], Math.max(lo[0], px));
      d.y = Math.min(hi[1], Math.max(lo[1], py));
      d.vx = vx;
      d.vy = vy;
    }
    // Push overlapping dots apart so they never merge.
    for (let i = 0; i < this.dots.length; i++) {
      for (let j = i + 1; j < this.dots.length; j++) {
        const a = this.dots[i];
        const b = this.dots[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist < r * 2.4 && dist > 0.001) {
          bounce(a, dx / dist, dy / dist);
          bounce(b, -dx / dist, -dy / dist);
        }
      }
    }
  }

  onPointer(p: { type: string; x: number; y: number }) {
    if (p.type !== "down" || this.phase !== "respond") return;
    let best: Dot | null = null;
    let bestD = this.r() * 2;
    for (const d of this.dots) {
      const dist = Math.hypot(p.x - d.x, p.y - d.y);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    if (!best) return;
    best.picked = !best.picked;
    const picked = this.dots.filter((d) => d.picked);
    if (picked.length === N_TARGETS) {
      const hits = picked.filter((d) => d.target).length;
      const ok = hits === N_TARGETS;
      this.stair.record(ok);
      this.feedback(ok);
      this.phase = "feedback";
      this.setStatus(`${hits} of ${N_TARGETS} correct`);
      this.after(1.4, () => this.next());
    }
  }

  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = "rgb(245, 245, 240)";
    g.fillRect(0, 0, this.width, this.height);
    if (!this.started || this.ended) return;
    const r = this.r();
    for (const d of this.dots) {
      circle(g, d.x, d.y, r, "rgb(20, 20, 20)");
      if (this.phase === "cue" && d.target) ring(g, d.x, d.y, r * 1.6, "rgb(230, 26, 26)", 3);
      if ((this.phase === "respond" || this.phase === "feedback") && d.picked) ring(g, d.x, d.y, r * 1.6, "rgb(51, 102, 242)", 3);
      if (this.phase === "feedback" && d.target) ring(g, d.x, d.y, r * 2.1, "rgb(26, 179, 51)", 3);
    }
  }

  summary() {
    if (this.stair.trials < 4) return { text: "Too few trials to estimate a threshold." };
    const th = this.stair.threshold();
    return {
      value: th,
      unit: "°/s",
      text: `Tracking speed threshold: ${th.toFixed(1)}°/s with ${N_TARGETS} targets\nAccuracy: ${Math.floor(this.stair.accuracy() * 100)}%\n\n(Higher is better.)`,
    };
  }
}

/** Godot's Vector2.bounce(n): v - 2 n (v . n). */
function bounce(d: Dot, nx: number, ny: number) {
  const dot = d.vx * nx + d.vy * ny;
  d.vx -= 2 * nx * dot;
  d.vy -= 2 * ny * dot;
}
