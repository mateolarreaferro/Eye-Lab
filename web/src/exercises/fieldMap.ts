import { Check, Eye } from "@phosphor-icons/react";
import { Exercise, rand, shuffle, type StagePointer } from "../exercise/Exercise";
import { circle, line } from "../exercise/draw";

/*
  Field-of-view mapping: fixate the centre, respond whenever a faint dot appears.
  Positions follow the polar grid from the slides, clipped to what the screen
  covers at your viewing distance. Cover one eye to find its blind spot (about
  15 degrees to the side). Port of eye_lab/exercises/field_map.gd.
*/

const RINGS = [3, 6, 10, 15, 20, 25, 30];
const SPOKES = 12;
const CATCH_FRACTION = 0.12;
const STIM_TIME = 0.2;
const RESPONSE_WINDOW = 1.1;

interface Spot {
  deg: [number, number];
  catch: boolean;
}

export default class FieldMap extends Exercise {
  queue: Spot[] = [];
  tested: { deg: [number, number]; seen: boolean }[] = [];
  current: Spot = { deg: [0, 0], catch: true };
  phase: "idle" | "wait" | "stim" | "window" | "results" = "idle";
  t = 0;
  falseAlarms = 0;
  catchTrials = 0;

  setup() {
    this.id = "field_map";
    this.title = "Visual field map";
    this.steps = [
      "Keep your eyes on the red dot in the middle the whole time.",
      "Small grey dots pop up around it.",
      'Click anywhere (or tap "I saw a dot") as soon as you see one.',
      "Some rounds have no dot, so don't guess.",
    ];
    this.instructions = "Tip: cover one eye to find its blind spot, about 15° out to that side.";
  }

  begin() {
    const hx = (this.width / 2 - 20) / this.ppd();
    const hy = (this.height / 2 - 20) / this.ppd();
    RINGS.forEach((ecc, ri) => {
      for (let s = 0; s < SPOKES; s++) {
        const a = ((s + (ri % 2 ? 0.5 : 0)) * Math.PI * 2) / SPOKES;
        const deg: [number, number] = [Math.cos(a) * ecc, Math.sin(a) * ecc];
        if (Math.abs(deg[0]) < hx && Math.abs(deg[1]) < hy) this.queue.push({ deg, catch: false });
      }
    });
    const nCatch = Math.floor(this.queue.length * CATCH_FRACTION);
    for (let i = 0; i < nCatch; i++) this.queue.push({ deg: [0, 0], catch: true });
    shuffle(this.queue);
    this.setAnswers([{ id: "seen", text: "I saw a dot", icon: Eye, tip: "Or click anywhere / press Space" }], { w: 200, h: 96 });
    this.next();
  }

  next() {
    const cur = this.queue.pop();
    if (!cur) {
      this.phase = "results";
      this.setStatus("Your map: green = seen, red = missed");
      this.setAnswers([{ id: "finish", text: "See summary", icon: Check }], { w: 200, h: 96 });
      return;
    }
    this.current = cur;
    this.phase = "wait";
    this.t = rand(0.8, 1.8);
    this.setStatus(`${this.queue.length} locations left`);
  }

  tick(dt: number) {
    this.t -= dt;
    if (this.t > 0) return;
    if (this.phase === "wait") {
      this.phase = "stim";
      this.t = STIM_TIME;
    } else if (this.phase === "stim") {
      this.phase = "window";
      this.t = RESPONSE_WINDOW - STIM_TIME;
    } else if (this.phase === "window") {
      this.resolve(false);
    }
  }

  resolve(pressed: boolean) {
    if (this.current.catch) {
      this.catchTrials++;
      this.falseAlarms += pressed ? 1 : 0;
    } else {
      this.tested.push({ deg: this.current.deg, seen: pressed });
    }
    this.next();
  }

  onAnswer(a: string | number) {
    if (a === "finish") this.end();
    else if (this.phase === "stim" || this.phase === "window") this.resolve(true);
    else if (this.phase === "wait") this.falseAlarms++;
  }

  onPointer(p: StagePointer) {
    if (p.type === "down") this.onAnswer(this.phase === "results" ? "finish" : "seen");
  }

  onKey(e: KeyboardEvent) {
    if (e.key !== " " || e.repeat) return false;
    this.onAnswer(this.phase === "results" ? "finish" : "seen");
    return true;
  }

  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = "rgb(46, 46, 46)";
    g.fillRect(0, 0, this.width, this.height);
    if (!this.started || this.ended) return;
    const cx = this.width / 2;
    const cy = this.height / 2;
    if (this.phase === "results") {
      this.drawResults(g, cx, cy);
      return;
    }
    circle(g, cx, cy, 5, "rgb(230, 38, 38)");
    if (this.phase === "stim" && !this.current.catch) {
      const ppd = this.ppd();
      const [dx, dy] = this.current.deg;
      circle(g, cx + dx * ppd, cy + dy * ppd, Math.min(10, Math.max(4, ppd * 0.2)), "rgb(107, 107, 107)");
    }
  }

  drawResults(g: CanvasRenderingContext2D, cx: number, cy: number) {
    const ppd = this.ppd();
    const diag = Math.hypot(this.width, this.height);
    const grid = "rgb(102, 102, 102)";
    g.font = `13px "Figtree Variable", system-ui, sans-serif`;
    g.textBaseline = "alphabetic";
    for (const ecc of RINGS) {
      const rr = ecc * ppd;
      if (rr >= diag) continue;
      g.strokeStyle = grid;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, rr, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = "rgb(153, 153, 153)";
      g.fillText(`${ecc}°`, cx + rr + 4, cy - 4);
    }
    line(g, 0, cy, this.width, cy, grid, 1);
    line(g, cx, 0, cx, this.height, grid, 1);
    for (const r of this.tested) {
      circle(g, cx + r.deg[0] * ppd, cy + r.deg[1] * ppd, 8, r.seen ? "rgb(51, 204, 77)" : "rgb(230, 51, 51)");
    }
  }

  summary() {
    if (this.tested.length < 10) return { text: "Too few locations tested." };
    const seen = this.tested.filter((r) => r.seen).length;
    const pct = (100 * seen) / this.tested.length;
    const snap = (v: number) => Math.round(v * 10) / 10;
    const misses = this.tested.filter((r) => !r.seen).map((r) => [snap(r.deg[0]), snap(r.deg[1])]);
    return {
      value: pct,
      unit: "% seen",
      text: `Seen: ${seen} / ${this.tested.length} locations (${pct.toFixed(0)}%)\nFalse alarms: ${this.falseAlarms} (catch trials: ${this.catchTrials})\n\nMissed spots can be your blind spot, a lapse in fixation, or a real field loss. Repeat before reading anything into it.`,
      detail: { missed_deg: misses, false_alarms: this.falseAlarms },
    };
  }
}
