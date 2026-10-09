import { Exercise } from "../exercise/Exercise";
import { fixation } from "../exercise/draw";
import { Staircase } from "../lib/staircase";
import { lab } from "../lib/lab";

/*
  Contrast sensitivity at several spatial frequencies (the curves in the slides).
  A Gabor patch tilts left or right; a staircase finds the faintest contrast you
  can still judge. Run it before and after a few weeks of frequency patching.
  Port of eye_lab/exercises/cs_test.gd; the patch is shaders/grating.gdshader
  (gabor mode) rendered once per trial into an offscreen canvas.
*/

const SFS = [1.5, 3.0, 6.0, 12.0]; // cycles per degree
const TRIALS_PER_SF = 18;
const STIM_TIME = 0.5;
const SF_NAMES: Record<number, string> = { 1.5: "wide", 3: "medium", 6: "narrow", 12: "very fine" };

type Phase = "idle" | "blank" | "stim" | "answer" | "feedback";

export default class Contrast extends Exercise {
  sfs: number[] = [];
  sfIndex = 0;
  stair = new Staircase(0.2, 0.002, 1.0, 1.5);
  results = new Map<number, number>(); // sf -> sensitivity
  tilt = 1;
  phase: Phase = "idle";
  gabor: HTMLCanvasElement | null = null;
  gaborVisible = false;
  gaborRect = { x: 0, y: 0, side: 0 };

  setup() {
    const s = lab.get().settings;
    this.id = "contrast";
    this.title = "Contrast sensitivity";
    this.steps = [
      "Look at the middle of the grey screen.",
      "A faint striped patch flashes for a moment.",
      "Tap which way the stripes lean.",
      "It gets fainter as you get it right, so guess if you're unsure.",
    ];
    this.instructions = `Four stripe sizes are tested, from wide to very fine. Testing ${s.eye.toLowerCase()} eye(s).`;
    // Skip frequencies the screen can't draw (need at least 4 px per cycle).
    this.sfs = SFS.filter((sf) => this.ppd() / sf >= 4);
  }

  begin() {
    this.setAnswers(
      [
        { id: -1, text: "Leans left", glyph: leanGlyph(-1), tip: "Shortcut: ←" },
        { id: 1, text: "Leans right", glyph: leanGlyph(1), tip: "Shortcut: →" },
      ],
      { w: 150, h: 110 },
    );
    this.startSf();
  }

  startSf() {
    if (this.sfIndex >= this.sfs.length) {
      this.end();
      return;
    }
    this.stair = new Staircase(0.2, 0.002, 1.0, 1.5);
    this.next();
  }

  next() {
    if (this.stair.trials >= TRIALS_PER_SF) {
      this.results.set(this.sfs[this.sfIndex], 1 / this.stair.threshold());
      this.sfIndex++;
      this.startSf();
      return;
    }
    this.phase = "blank";
    this.gaborVisible = false;
    this.setAnswersEnabled(false);
    const sf = this.sfs[this.sfIndex];
    this.setStatus(
      `Stripe size ${this.sfIndex + 1} of ${this.sfs.length} (${SF_NAMES[sf] ?? ""}), ${this.stair.trials + 1} / ${TRIALS_PER_SF}`,
    );
    this.after(0.6, () => this.show());
  }

  show() {
    const dpr = window.devicePixelRatio || 1;
    const side = Math.min(4 * this.ppd(), this.height * 0.5);
    const px = Math.max(1, Math.round(side * dpr));
    // Snap to device pixels so the bitmap maps 1:1 onto the screen.
    const snap = (v: number) => Math.round(v * dpr) / dpr;
    this.gaborRect = {
      x: snap((this.width - px / dpr) / 2),
      y: snap((this.height - px / dpr) / 2 - 50),
      side: px / dpr,
    };
    this.tilt = Math.random() < 0.5 ? 1 : -1;
    this.gabor = renderGabor(px, (this.sfs[this.sfIndex] * side) / this.ppd(), 45 * this.tilt, this.stair.value, Math.random() * Math.PI * 2);
    this.gaborVisible = true;
    this.phase = "stim";
    this.setAnswersEnabled(true);
    this.after(STIM_TIME, () => {
      this.gaborVisible = false;
      if (this.phase === "stim") this.phase = "answer";
    });
  }

  onAnswer(a: string | number) {
    if (this.phase !== "stim" && this.phase !== "answer") return;
    this.gaborVisible = false;
    const ok = Number(a) === this.tilt;
    this.stair.record(ok);
    this.feedback(ok);
    this.phase = "feedback";
    this.setAnswersEnabled(false);
    this.after(0.3, () => this.next());
  }

  onKey(e: KeyboardEvent) {
    if (e.repeat) return false;
    if (e.key === "ArrowRight" || e.key === "d") this.onAnswer(1);
    else if (e.key === "ArrowLeft" || e.key === "a") this.onAnswer(-1);
    else return false;
    return true;
  }

  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = "rgb(128, 128, 128)";
    g.fillRect(0, 0, this.width, this.height);
    if (!this.started || this.ended) return;
    const cy = this.height / 2 - 50;
    if (this.gaborVisible && this.gabor) {
      const r = this.gaborRect;
      g.imageSmoothingEnabled = false;
      g.drawImage(this.gabor, r.x, r.y, r.side, r.side);
    }
    if (this.phase === "blank") fixation(g, this.width / 2, cy, 8, "rgb(77, 77, 77)");
    else if (this.phase === "answer") this.drawPrompt(g, "Which way did the stripes lean?", cy, "rgb(56, 56, 56)");
  }

  summary() {
    if (this.results.size === 0) return { text: "Stopped before any stripe size was finished." };
    const lines: string[] = [];
    let logSum = 0;
    const detail: Record<string, number> = {};
    for (const [sf, cs] of this.results) {
      logSum += Math.log10(cs);
      detail[String(sf)] = cs;
      lines.push(`•  ${capitalize(SF_NAMES[sf] ?? "")} stripes (${sf.toFixed(1)} c/°): you saw them down to ${(100 / cs).toFixed(2)}% contrast`);
    }
    const meanLog = logSum / this.results.size;
    return {
      value: meanLog,
      unit: "mean log CS",
      text:
        lines.join("\n") +
        `\n\nOverall score: ${meanLog.toFixed(2)} (higher is better).\nA screen can't show very faint contrast precisely, so compare against your own earlier results, not clinical charts.`,
      detail,
    };
  }
}

/** grating.gdshader with gabor = true: a sine grating under a Gaussian envelope on
 * mid-grey, dithered so very low contrasts survive 8-bit output. angle 0 gives
 * vertical bars, +45 leans them like "/". */
function renderGabor(n: number, cycles: number, angleDeg: number, contrast: number, phase: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const g = c.getContext("2d")!;
  const img = g.createImageData(n, n);
  const a = (angleDeg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const k = Math.PI * 2 * cycles;
  const s2 = 2 * 0.15 * 0.15;
  for (let j = 0; j < n; j++) {
    const py = (j + 0.5) / n - 0.5;
    for (let i = 0; i < n; i++) {
      const px = (i + 0.5) / n - 0.5;
      const w = Math.sin(k * (px * ca + py * sa) + phase);
      const env = Math.exp(-(px * px + py * py) / s2);
      const dither = (Math.random() - 0.5) / 255;
      const v = Math.round(Math.min(1, Math.max(0, 0.5 + 0.5 * contrast * w * env + dither)) * 255);
      const o = (j * n + i) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** The lean_left / lean_right icons: tilted stripes clipped to a ring. */
function leanGlyph(dir: number) {
  return (g: CanvasRenderingContext2D, size: number, ink: string) => {
    const u = size / 24;
    g.save();
    g.scale(u, u);
    g.strokeStyle = ink;
    g.lineCap = "round";
    g.beginPath();
    g.arc(12, 12, 9, 0, Math.PI * 2);
    g.save();
    g.clip();
    g.lineWidth = 2.6;
    g.beginPath();
    for (const x of [-3, 3, 9, 15]) {
      if (dir < 0) {
        g.moveTo(x, 0);
        g.lineTo(x + 12, 24);
      } else {
        g.moveTo(24 - x, 0);
        g.lineTo(12 - x, 24);
      }
    }
    g.stroke();
    g.restore();
    g.lineWidth = 2;
    g.beginPath();
    g.arc(12, 12, 9, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  };
}

const capitalize = (s: string) => s.replace(/\b\w/g, (ch) => ch.toUpperCase());
