import { Exercise, pick, rand, shuffle } from "../exercise/Exercise";
import { ring, shape, SHAPES, type ShapeKind } from "../exercise/draw";

/*
  Directed search: memorise a reference object, then find it in a crowded field
  (Where's Waldo style). Distractors share its shape or its color, so you have to
  bind both features. The field gets more crowded as you go.
  Port of eye_lab/exercises/search.gd.
*/

const TRIALS = 14;
const COLORS = [
  "rgb(217, 38, 38)",
  "rgb(38, 115, 230)",
  "rgb(26, 166, 77)",
  "rgb(242, 191, 26)",
  "rgb(153, 64, 204)",
  "rgb(242, 128, 26)",
  "rgb(26, 26, 26)",
];
const TIMEOUT = 25;

interface Item {
  x: number;
  y: number;
  shape: ShapeKind;
  color: string;
  target: boolean;
}

export default class Search extends Exercise {
  trial = 0;
  target: { shape: ShapeKind; color: string } = { shape: "circle", color: COLORS[0] };
  items: Item[] = [];
  phase: "idle" | "reference" | "search" | "feedback" = "idle";
  t0 = 0;
  rts: number[] = [];
  misses = 0;
  wrongClicks = 0;

  setup() {
    this.id = "search";
    this.title = "Directed search";
    this.steps = ["Remember the shape shown first.", "Then find it in a crowd of shapes.", "Tap it as fast as you can.", "Careful: some share its shape, some its color."];
    this.instructions = "";
  }

  begin() {
    this.next();
  }

  r() {
    return Math.min(26, Math.max(12, this.ppd() * 0.4));
  }

  next() {
    this.trial++;
    if (this.trial > TRIALS) {
      this.end();
      return;
    }
    this.target = { shape: pick(SHAPES), color: pick(COLORS) };
    this.phase = "reference";
    this.setStatus(`Round ${this.trial} of ${TRIALS}, remember this one`);
    this.after(1.5, () => this.showField());
  }

  showField() {
    const n = 30 + this.trial * 8;
    const r = this.r();
    const ax = r * 2;
    const ay = 80;
    const aw = this.width - r * 4;
    const ah = this.height - 140;
    const cols = Math.ceil(Math.sqrt((n * aw) / ah));
    const rows = Math.ceil(n / cols);
    const cw = aw / cols;
    const ch = ah / rows;
    const cells = shuffle([...Array(cols * rows).keys()]);
    const jx = Math.max(cw - r * 2.2, 0) / 2;
    const jy = Math.max(ch - r * 2.2, 0) / 2;
    this.items = [];
    for (let i = 0; i < n; i++) {
      const cx = cells[i] % cols;
      const cy = Math.floor(cells[i] / cols);
      const x = ax + (cx + 0.5) * cw + rand(-jx, jx);
      const y = ay + (cy + 0.5) * ch + rand(-jy, jy);
      let s = this.target.shape;
      let color = this.target.color;
      if (i > 0) {
        // Conjunction search: half the distractors share the shape, half the color.
        while (s === this.target.shape && color === this.target.color) {
          if (Math.random() < 0.5) color = pick(COLORS);
          else s = pick(SHAPES);
        }
      }
      this.items.push({ x, y, shape: s, color, target: i === 0 });
    }
    this.phase = "search";
    this.t0 = performance.now() / 1000;
    this.setStatus(`Round ${this.trial} of ${TRIALS}, ${n} objects`);
    this.after(TIMEOUT, () => {
      if (this.phase === "search") {
        this.misses++;
        this.feedback(false);
        this.phase = "feedback";
        this.after(1.2, () => this.next());
      }
    });
  }

  onPointer(p: { type: string; x: number; y: number }) {
    if (p.type !== "down" || this.phase !== "search") return;
    const r = this.r();
    for (const it of this.items) {
      if (Math.hypot(p.x - it.x, p.y - it.y) < r * 1.3) {
        if (it.target) {
          this.rts.push(performance.now() / 1000 - this.t0);
          this.feedback(true);
          this.phase = "feedback";
          this.setStatus(`Found in ${this.rts[this.rts.length - 1].toFixed(2)} s`);
          this.after(0.9, () => this.next());
        } else {
          this.wrongClicks++;
          this.feedback(false);
        }
        return;
      }
    }
  }

  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = "rgb(247, 245, 235)";
    g.fillRect(0, 0, this.width, this.height);
    if (!this.started || this.ended) return;
    const r = this.r();
    if (this.phase === "reference") {
      g.fillStyle = "rgb(51, 51, 51)";
      g.font = `24px "Figtree Variable", system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "alphabetic";
      g.fillText("Find this:", this.width / 2, this.height / 2 - r * 4);
      shape(g, this.target.shape, this.width / 2, this.height / 2, r * 2.5, this.target.color);
      return;
    }
    for (const it of this.items) shape(g, it.shape, it.x, it.y, r, it.color);
    if (this.phase === "feedback") {
      for (const it of this.items) if (it.target) ring(g, it.x, it.y, r * 2, "rgb(26, 179, 51)", 4);
    }
  }

  summary() {
    if (this.rts.length < 3) return { text: "Too few targets found to score this session." };
    const sorted = [...this.rts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return {
      value: median,
      unit: "s",
      text: `Median search time: ${median.toFixed(2)} s\nFound ${this.rts.length} / ${TRIALS}, wrong clicks: ${this.wrongClicks}\n\n(Lower is better.)`,
    };
  }
}
