import { Exercise, rand, randi } from "../exercise/Exercise";
import { fixation, sun } from "../exercise/draw";
import { Staircase } from "../lib/staircase";

/*
  "How many spots of light?" (number of attentional foci). Lights flash briefly
  anywhere in the field while you fixate the centre; the flash gets shorter as
  you improve. Port of eye_lab/exercises/spot_count.gd.
*/

const TRIALS = 20;

export default class SpotCount extends Exercise {
  stair = new Staircase(900, 40, 2500, 1.3);
  trial = 0;
  spots: [number, number][] = [];
  n = 0;
  phase: "idle" | "fixate" | "show" | "answer" | "feedback" = "idle";

  setup() {
    this.id = "spot_count";
    this.title = "Counting lights";
    this.steps = [
      "Keep your eyes on the cross in the middle.",
      "A few lights flash for a moment.",
      "Tap how many lights you saw.",
      "The flashes get shorter as you improve.",
    ];
    this.instructions = "";
  }

  begin() {
    const opts = [];
    for (let i = 1; i < 10; i++) opts.push({ id: i, text: String(i) });
    this.setAnswers(opts, { w: 72, h: 72 });
    this.next();
  }

  next() {
    this.trial++;
    if (this.trial > TRIALS) {
      this.end();
      return;
    }
    this.phase = "fixate";
    this.spots = [];
    this.setAnswersEnabled(false);
    this.setStatus(`Round ${this.trial} of ${TRIALS}, flash ${Math.floor(this.stair.value)} ms`);
    this.after(rand(0.7, 1.2), () => this.show());
  }

  show() {
    this.n = randi(1, 7);
    const r = this.spotR();
    const cx = this.width / 2;
    const cy = this.height / 2;
    let tries = 0;
    while (this.spots.length < this.n && tries < 2000) {
      tries++;
      const x = rand(r * 2, this.width - r * 2);
      const y = rand(r * 2 + 70, this.height - r * 2 - 130);
      if (Math.hypot(x - cx, y - cy) < r * 4) continue;
      if (this.spots.some(([qx, qy]) => Math.hypot(x - qx, y - qy) < r * 4)) continue;
      this.spots.push([x, y]);
    }
    this.n = this.spots.length;
    this.phase = "show";
    this.setAnswersEnabled(true);
    this.after(this.stair.value / 1000, () => {
      this.phase = "answer";
    });
  }

  spotR() {
    return Math.min(30, Math.max(12, this.ppd() * 0.45));
  }

  onAnswer(k: string | number) {
    if (this.phase !== "show" && this.phase !== "answer") return;
    const ok = Number(k) === this.n;
    this.stair.record(ok);
    this.feedback(ok);
    this.phase = "feedback";
    this.setAnswersEnabled(false);
    this.setStatus(ok ? `Correct, there were ${this.n}.` : `There were ${this.n}.`);
    this.after(0.9, () => this.next());
  }

  onKey(e: KeyboardEvent) {
    if (e.repeat || !/^[1-9]$/.test(e.key)) return false;
    this.onAnswer(Number(e.key));
    return true;
  }

  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = "#000000";
    g.fillRect(0, 0, this.width, this.height);
    if (!this.started || this.ended) return;
    fixation(g, this.width / 2, this.height / 2, 12);
    if (this.phase === "show" || this.phase === "feedback") {
      const r = this.spotR();
      for (const [x, y] of this.spots) sun(g, x, y, r);
    }
    if (this.phase === "answer") this.drawPrompt(g, "How many lights did you see?", this.height / 2 + 64);
  }

  summary() {
    if (this.stair.trials < 8) return { text: "Too few rounds to measure. Try a full session next time." };
    const th = this.stair.threshold();
    return {
      value: th,
      unit: "ms",
      text: `You can count the lights reliably in flashes as short as ${Math.floor(th)} ms.\nAccuracy: ${Math.floor(this.stair.accuracy() * 100)}%\n\nShorter is better.`,
    };
  }
}
