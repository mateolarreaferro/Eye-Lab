import { Exercise } from "../exercise/Exercise";
import { tumblingE } from "../exercise/draw";
import { Staircase } from "../lib/staircase";
import { isCalibrated, lab } from "../lib/lab";

/*
  Tumbling-E acuity test: 4 alternatives, 3-down-1-up staircase on letter size.
  Reports logMAR and the Snellen equivalent. Accuracy depends on calibration and
  distance. Port of eye_lab/exercises/acuity_test.gd.
*/

const MAX_TRIALS = 60;
const MAX_REVERSALS = 10;
const DIR_NAMES = ["Right", "Down", "Left", "Up"];

export default class Acuity extends Exercise {
  // Staircase variable: stroke width in arcmin (the E is 5 strokes tall). Starts at 20/200.
  stair = new Staircase(10, 0.2, 40, 1.26, true, 3);
  dir = 0;
  phase: "idle" | "show" | "feedback" = "idle";

  setup() {
    const s = lab.get().settings;
    this.id = "acuity";
    this.title = "Acuity test";
    this.steps = [
      `Sit ${Math.round(s.distanceCm)} cm from the screen and stay there.`,
      "A letter E appears in the middle.",
      "Tap the E button that points the same way.",
      "Not sure? Take a guess. It's part of the test.",
    ];
    this.instructions = `Testing ${s.eye.toLowerCase()} eye(s). If you're testing one eye, cover the other.`;
  }

  begin() {
    this.setAnswers(
      DIR_NAMES.map((text, d) => ({
        id: d,
        text,
        glyph: (g: CanvasRenderingContext2D, size: number, ink: string) => tumblingE(g, size / 2, size / 2, size * 0.7, d, ink),
      })),
      { w: 110, h: 110 },
    );
    this.next();
  }

  /** One physical screen pixel, in arcmin. */
  minStroke() {
    return 60 / (this.ppd() * (window.devicePixelRatio || 1));
  }

  next() {
    if (this.stair.trials >= MAX_TRIALS || this.stair.reversals.length >= MAX_REVERSALS) {
      this.end();
      return;
    }
    this.stair.value = Math.max(this.stair.value, this.minStroke());
    this.dir = Math.floor(Math.random() * 4);
    this.phase = "show";
    this.setAnswersEnabled(true);
    this.setStatus(`Letter ${this.stair.trials + 1}, size ${snellen(this.stair.value)}`);
  }

  onAnswer(a: string | number) {
    if (this.phase !== "show") return;
    const ok = Number(a) === this.dir;
    this.stair.record(ok);
    this.feedback(ok);
    this.phase = "feedback";
    this.setAnswersEnabled(false);
    this.after(0.35, () => this.next());
  }

  onKey(e: KeyboardEvent) {
    const map: Record<string, number> = { ArrowRight: 0, d: 0, ArrowDown: 1, s: 1, ArrowLeft: 2, a: 2, ArrowUp: 3, w: 3 };
    if (!(e.key in map) || e.repeat) return false;
    this.onAnswer(map[e.key]);
    return true;
  }

  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, this.width, this.height);
    if (!this.started || this.ended || this.phase !== "show") return;
    const letterPx = ((this.stair.value * 5) / 60) * this.ppd();
    tumblingE(g, Math.round(this.width / 2), Math.round(this.height / 2 - 50), Math.max(letterPx, 5 / (window.devicePixelRatio || 1)), this.dir, "#000000");
  }

  summary() {
    if (this.stair.trials < 12) return { text: "Too few letters to measure acuity. Try a full session next time." };
    const s = lab.get().settings;
    const th = this.stair.threshold();
    const logmar = Math.log10(th);
    let notes = "";
    if (th <= this.minStroke() * 1.3) {
      notes += "\n\nYou reached the smallest letter this screen can draw. Sit further back (and update the distance in Settings) to measure finer.";
    }
    if (!isCalibrated()) notes += "\n\nYour screen isn't calibrated yet, so this is an estimate.";
    return {
      value: logmar,
      unit: "logMAR",
      text: `Your acuity: about ${snellen(th)} (${logmar.toFixed(2)} logMAR)\nEye: ${s.eye}, distance ${Math.round(s.distanceCm)} cm${notes}\n\n20/20 (0.0 logMAR) is typical adult vision; lower numbers are better.`,
      detail: { snellen: snellen(th), distance_cm: s.distanceCm },
    };
  }
}

const snellen = (strokeArcmin: number) => `20/${Math.round(20 * strokeArcmin)}`;
