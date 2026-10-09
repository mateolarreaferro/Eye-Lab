import { Exercise, rand, randi } from "../exercise/Exercise";
import { circle, hsv, tumblingE } from "../exercise/draw";
import { Staircase } from "../lib/staircase";

/*
  Sinha-lab "odd one out": triads of disks appear along a winding path anywhere in
  the visual field; click the one that differs. A staircase makes the difference
  smaller as you get better. Modes: color, acuity, orientation, depth (red/cyan
  glasses). Port of eye_lab/exercises/odd_one_out.gd.
*/

const TRIALS = 30;
const GRATING_CPD = 3.0;
const TAU = Math.PI * 2;

type Mode = "color" | "acuity" | "orientation" | "depth";

interface Disk {
  x: number;
  y: number;
  r: number;
  odd: boolean;
  hue: number;
  rot: number;
  angle: number;
  disp: number;
  /** Orientation mode: the grating, rendered once per trial. */
  grating?: HTMLCanvasElement;
}

const STEPS: Record<Mode, string[]> = {
  color: ["Three disks pop up somewhere on the path.", "One of them is a slightly different color.", "Tap the odd one out.", "The colors get closer as you improve."],
  acuity: ["Three disks with a letter E pop up on the path.", "One E points a different way.", "Tap the odd one out.", "The letters shrink as you improve."],
  orientation: ["Three striped disks pop up on the path.", "One disk's stripes are tilted differently.", "Tap the odd one out.", "The tilt gets smaller as you improve."],
  depth: ["Put on red/cyan 3D glasses, red lens over your LEFT eye.", "Three disks appear.", "One floats in front of or behind the other two.", "Tap the one that's at a different depth."],
};

export default class OddOneOut extends Exercise {
  mode: Mode = "color";
  stair = new Staircase(40, 0.5, 120, 1.5);
  trial = 0;
  disks: Disk[] = [];
  waiting = false;

  path: [number, number][] = [];
  grass: { x0: number; y0: number; x1: number; y1: number; color: string }[] = [];
  private builtFor = "";

  setup() {
    this.mode = (this.config.mode as Mode) ?? "color";
    this.id = "odd_" + this.mode;
    this.title = "Odd one out: " + this.mode[0].toUpperCase() + this.mode.slice(1);
    this.steps = STEPS[this.mode];
    this.instructions = "";
    switch (this.mode) {
      case "color":
        this.stair = new Staircase(40, 0.5, 120, 1.5);
        break;
      case "acuity":
        this.stair = new Staircase(Math.max(this.ppd() * 0.6, 24), 5, 200, 1.3);
        break;
      case "orientation":
        this.stair = new Staircase(30, 0.5, 60, 1.5);
        break;
      case "depth":
        this.instructions = "This game only works with 3D glasses.";
        this.stair = new Staircase(12, 1, 40, 1.4);
        break;
    }
  }

  begin() {
    this.buildPath();
    this.next();
  }

  /** The winding path and the grass, seeded so they don't flicker. Rebuilt on resize. */
  buildPath() {
    const w = this.width;
    const h = this.height;
    this.builtFor = `${w}x${h}`;
    this.path = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      this.path.push([w * (0.5 + 0.36 * Math.sin(t * TAU * 1.05 + 0.9)), h * (1.02 - 0.97 * t)]);
    }
    const rng = seeded(7);
    this.grass = [];
    for (let i = 0; i < 900; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const shade = -0.12 + rng() * 0.22;
      const dx = -3 + rng() * 6;
      const dy = -(6 + rng() * 10);
      this.grass.push({ x0: x, y0: y, x1: x + dx, y1: y + dy, color: rgb(0.3 + shade, 0.58 + shade, 0.18 + shade * 0.5) });
    }
  }

  pathPoint(t: number): [number, number] {
    const f = t * (this.path.length - 1);
    const i = Math.floor(f);
    const a = this.path[i];
    const b = this.path[Math.min(i + 1, this.path.length - 1)];
    return [a[0] + (b[0] - a[0]) * (f - i), a[1] + (b[1] - a[1]) * (f - i)];
  }

  next() {
    this.trial++;
    if (this.trial > TRIALS) {
      this.end();
      return;
    }
    const t = rand(0.03, 0.97);
    let r = clamp(this.ppd() * 0.75, 30, 80) * (1 + (0.55 - 1) * t);
    if (this.mode === "acuity") r = Math.max(r * 0.8, this.stair.value * 0.85 + 6);
    const [px, py] = this.pathPoint(t);
    const m = r * 2.3;
    // Stay clear of the filter badge.
    const cx = clamp(px + rand(-1, 1) * r, m, this.width - m);
    const cy = clamp(py + rand(-1, 1) * r, m + 70, this.height - (m + 90));

    const odd = randi(0, 2);
    const baseHue = Math.random();
    const baseRot = randi(0, 3);
    const oddRot = (baseRot + 1 + randi(0, 2)) % 4;
    const baseAngle = Math.random() * 180;
    const sign = Math.random() < 0.5 ? 1 : -1;
    const baseDisp = rand(-4, 4);
    const offsets: [number, number][] = [[0, -1], [-0.9, 0.55], [0.9, 0.55]];
    const v = this.stair.value;
    this.disks = offsets.map(([ox, oy], i) => {
      const isOdd = i === odd;
      return {
        x: cx + ox * r * 1.15,
        y: cy + oy * r * 1.15,
        r,
        odd: isOdd,
        hue: wrap01(baseHue + (isOdd ? (v / 360) * sign : 0)),
        rot: isOdd ? oddRot : baseRot,
        angle: baseAngle + (isOdd ? v * sign : 0),
        disp: baseDisp + (isOdd ? v * sign : 0),
      };
    });
    if (this.mode === "orientation") {
      const cycles = Math.max(2.5, ((2 * r) / this.ppd()) * GRATING_CPD);
      for (const d of this.disks) d.grating = grating(2 * r, cycles, d.angle, Math.random() * TAU);
    }
    this.waiting = true;
    this.setStatus(`Round ${this.trial} of ${TRIALS}, difference ${this.differenceText(v)}`);
  }

  differenceText(v: number) {
    switch (this.mode) {
      case "color":
        return `${v.toFixed(1)}° hue`;
      case "acuity":
        return `letter ${v.toFixed(0)} px (${((v / this.ppd()) * 60).toFixed(1)} arcmin)`;
      case "orientation":
        return `${v.toFixed(1)}° tilt`;
      case "depth":
        return `${((v / this.ppd()) * 3600).toFixed(0)} arcsec`;
    }
  }

  onPointer(p: { type: string; x: number; y: number }) {
    if (p.type !== "down" || !this.waiting) return;
    for (const d of this.disks) {
      if (Math.hypot(p.x - d.x, p.y - d.y) <= d.r * 1.1) {
        this.waiting = false;
        this.stair.record(d.odd);
        this.feedback(d.odd);
        this.after(0.45, () => this.next());
        return;
      }
    }
  }

  draw(g: CanvasRenderingContext2D) {
    if (this.started && this.builtFor !== `${this.width}x${this.height}`) this.buildPath();
    if (this.mode === "depth") {
      g.fillStyle = "#000000";
      g.fillRect(0, 0, this.width, this.height);
      this.drawAnaglyph(g);
      return;
    }
    g.fillStyle = rgb(0.33, 0.6, 0.2);
    g.fillRect(0, 0, this.width, this.height);
    g.lineWidth = 2;
    for (const b of this.grass) {
      g.strokeStyle = b.color;
      g.beginPath();
      g.moveTo(b.x0, b.y0);
      g.lineTo(b.x1, b.y1);
      g.stroke();
    }
    if (this.path.length > 1) {
      const pw = this.width * 0.075;
      g.save();
      g.lineJoin = "round";
      g.beginPath();
      this.path.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokeStyle = rgb(0.55, 0.57, 0.55);
      g.lineWidth = pw + 8;
      g.stroke();
      g.strokeStyle = rgb(0.8, 0.82, 0.82);
      g.lineWidth = pw;
      g.stroke();
      g.restore();
    }
    if (!this.started || this.ended) return;
    for (const d of this.disks) {
      switch (this.mode) {
        case "color":
          circle(g, d.x, d.y, d.r, hsv(d.hue, 0.75, 0.78));
          break;
        case "acuity":
          circle(g, d.x, d.y, d.r, rgb(0.1, 0.35, 0.25));
          circle(g, d.x, d.y, d.r - 3, "#ffffff");
          tumblingE(g, d.x, d.y, this.stair.value, d.rot, "#000000");
          break;
        case "orientation":
          circle(g, d.x, d.y, d.r + 3, rgb(0.05, 0.05, 0.05));
          if (d.grating) g.drawImage(d.grating, d.x - d.r, d.y - d.r, d.r * 2, d.r * 2);
          break;
      }
    }
  }

  /** Additive red/cyan copies. Left eye (red lens) sees the red copy; shifting it right brings the disk closer. */
  drawAnaglyph(g: CanvasRenderingContext2D) {
    if (!this.started || this.ended) return;
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const d of this.disks) {
      const half = d.disp / 2;
      circle(g, d.x + half, d.y, d.r, "rgb(204, 0, 0)");
      circle(g, d.x - half, d.y, d.r, "rgb(0, 179, 204)");
    }
    g.restore();
  }

  summary() {
    if (this.stair.trials < 8) return { text: "Too few trials to estimate a threshold." };
    const th = this.stair.threshold();
    let value = th;
    let unit = "";
    switch (this.mode) {
      case "color":
        unit = "° hue";
        break;
      case "acuity":
        value = Math.log10(((th / 5) / this.ppd()) * 60); // logMAR of the E stroke
        unit = "logMAR";
        break;
      case "orientation":
        unit = "° tilt";
        break;
      case "depth":
        value = (th / this.ppd()) * 3600;
        unit = "arcsec";
        break;
    }
    return {
      value,
      unit,
      text: `Threshold: ${value.toFixed(2)} ${unit}\nAccuracy: ${Math.floor(this.stair.accuracy() * 100)}%, Trophies: ${this.trophies}\n\n(Lower is better.)`,
    };
  }
}

/**
 * Sine grating in a disk on a size x size (CSS px) box, rendered at device
 * resolution. Port of shaders/grating.gdshader (disk mode, full contrast, dithered).
 */
function grating(size: number, cycles: number, angleDeg: number, phase: number): HTMLCanvasElement {
  const dpr = window.devicePixelRatio || 1;
  const n = Math.max(1, Math.round(size * dpr));
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(n, n);
  const a = (angleDeg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  for (let j = 0; j < n; j++) {
    const py = (j + 0.5) / n - 0.5;
    for (let i = 0; i < n; i++) {
      const px = (i + 0.5) / n - 0.5;
      const r = Math.hypot(px, py);
      const w = Math.sin(TAU * cycles * (px * ca + py * sa) + phase);
      const dither = (Math.random() - 0.5) / 255;
      const v = clamp(0.5 + 0.5 * w + dither, 0, 1) * 255;
      const disk = 1 - smoothstep(0.48, 0.5, r);
      const k = (j * n + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
      img.data[k + 3] = disk * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Small seeded PRNG (mulberry32), 0..1. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wrap01 = (v: number) => v - Math.floor(v);
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const rgb = (r: number, g: number, b: number) =>
  `rgb(${Math.round(clamp(r, 0, 1) * 255)}, ${Math.round(clamp(g, 0, 1) * 255)}, ${Math.round(clamp(b, 0, 1) * 255)})`;
