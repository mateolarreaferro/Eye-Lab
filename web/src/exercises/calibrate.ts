import { Check, Minus, Plus } from "@phosphor-icons/react";
import { Exercise, type StagePointer } from "../exercise/Exercise";
import { lab, pxPerCm, pxPerDeg, setSetting } from "../lib/lab";

/*
  Screen calibration: resize the rectangle until it matches a credit/ID card
  (85.6 mm wide, ISO/IEC 7810 ID-1). Gives pixels per cm for visual-angle maths.
  Port of eye_lab/exercises/calibrate.gd. The desktop slider is replaced by
  dragging on the stage, the Smaller/Bigger buttons and the arrow keys.
*/

const CARD_W_CM = 8.56;
const CARD_H_CM = 5.398;
const MIN_W = 150;

export default class Calibrate extends Exercise {
  cardW = 400;
  saved = false;
  drag: { x: number; w: number; dir: number } | null = null;

  setup() {
    this.id = "calibrate";
    this.title = "Calibrate screen";
    this.steps = [
      "Hold a bank card flat against the screen.",
      "Drag left or right on the screen, or use Smaller and Bigger (or the arrow keys), until the rectangle is exactly as wide as the card.",
      "Tap Save.",
    ];
    this.instructions = "This lets the lab draw things at their true size, which the tests need.";
    this.cardW = pxPerCm() * CARD_W_CM;
  }

  begin() {
    this.setAnswers(
      [
        { id: "minus", text: "Smaller", icon: Minus, tip: "Shortcut: ← or ↓" },
        { id: "plus", text: "Bigger", icon: Plus, tip: "Shortcut: → or ↑" },
        { id: "save", text: "Save", icon: Check },
      ],
      { w: 120, h: 96 },
    );
    this.setWidth(this.cardW);
  }

  /** Same range and step as the desktop slider. */
  setWidth(w: number) {
    this.cardW = Math.min(Math.max(MIN_W, this.width - 80), Math.max(MIN_W, Math.round(w * 2) / 2));
  }

  onAnswer(a: string | number) {
    if (a === "minus") this.setWidth(this.cardW - 1);
    else if (a === "plus") this.setWidth(this.cardW + 1);
    else if (a === "save") {
      setSetting("pxPerCm", this.cardW / CARD_W_CM);
      this.saved = true;
      this.end();
    }
  }

  onPointer(p: StagePointer) {
    if (p.type === "down") {
      // The card is centred, so moving one edge by dx changes the width by 2 dx.
      this.drag = { x: p.x, w: this.cardW, dir: p.x >= this.width / 2 ? 1 : -1 };
      // Released over the answer buttons or outside the window: stop dragging too.
      window.addEventListener("pointerup", () => (this.drag = null), { once: true });
    } else if (p.type === "move" && this.drag) {
      this.setWidth(this.drag.w + 2 * this.drag.dir * (p.x - this.drag.x));
    } else if (p.type === "up") {
      this.drag = null;
    }
  }

  onKey(e: KeyboardEvent) {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") this.setWidth(this.cardW + step);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") this.setWidth(this.cardW - step);
    else return false;
    return true;
  }

  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = "#f4f3ef";
    g.fillRect(0, 0, this.width, this.height);
    if (!this.started || this.ended) return;
    const w = this.cardW;
    const h = (w * CARD_H_CM) / CARD_W_CM;
    const x = (this.width - w) / 2;
    const y = (this.height - h) / 2 - 80;
    g.globalAlpha = 0.18;
    g.fillStyle = this.accent;
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
    g.strokeStyle = this.accent;
    g.lineWidth = 2;
    g.strokeRect(x, y, w, h);
    this.drawPrompt(g, "Match the width of a bank card", y - 24, "#7a7080", 18);
    this.drawPrompt(g, `${(w / CARD_W_CM).toFixed(1)} px per cm`, y + h + 36, "#2d2a32", 18);
  }

  summary() {
    if (!this.saved) return null;
    const s = lab.get().settings;
    return {
      text: `Saved: ${s.pxPerCm.toFixed(1)} px per cm.\nAt ${Math.trunc(s.distanceCm)} cm from the screen, 1° of your vision covers ${pxPerDeg().toFixed(0)} px.`,
    };
  }
}
