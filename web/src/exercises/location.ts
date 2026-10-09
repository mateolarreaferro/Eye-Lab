import { ArrowsOutCardinal, MapPin } from "@phosphor-icons/react";
import { Exercise, rand } from "../exercise/Exercise";
import { fixation, sun } from "../exercise/draw";
import { Staircase } from "../lib/staircase";

/*
  Spatial localization: a light, a blank, then a light again. Same place or
  different? The shift shrinks as you improve. Only "moved" trials drive the
  staircase. Port of eye_lab/exercises/location.gd.
*/

const TRIALS = 36;

export default class Location extends Exercise {
  stair = new Staircase(2.0, 0.05, 8.0, 1.4);
  trial = 0;
  p1: [number, number] = [0, 0];
  p2: [number, number] = [0, 0];
  same = true;
  phase: "idle" | "fixate" | "first" | "blank" | "second" | "answer" | "feedback" = "idle";
  sameCorrect = 0;
  sameTotal = 0;

  setup() {
    this.id = "location";
    this.title = "Same place?";
    this.steps = [
      "Keep your eyes on the cross in the middle.",
      "A light appears, then disappears.",
      "It comes back, in the same spot or a new one.",
      'Tap "Same place" or "It moved".',
    ];
    this.instructions = "";
  }

  begin() {
    this.setAnswers(
      [
        { id: "same", text: "Same place", icon: MapPin, tip: "Shortcut: S" },
        { id: "moved", text: "It moved", icon: ArrowsOutCardinal, tip: "Shortcut: D" },
      ],
      { w: 160, h: 104 },
    );
    this.next();
  }

  lightR() {
    return Math.min(24, Math.max(10, this.ppd() * 0.35));
  }

  next() {
    this.trial++;
    if (this.trial > TRIALS) {
      this.end();
      return;
    }
    this.phase = "fixate";
    this.setAnswersEnabled(false);
    this.setStatus(`Round ${this.trial} of ${TRIALS}, shift ${this.stair.value.toFixed(2)}°`);
    const r = this.lightR();
    const shift = this.stair.value * this.ppd();
    const margin = r * 3 + shift;
    this.p1 = [rand(margin, this.width - margin), rand(margin + 70, this.height - margin - 140)];
    this.same = Math.random() < 0.4;
    const a = Math.random() * Math.PI * 2;
    this.p2 = this.same ? [...this.p1] : [this.p1[0] + Math.cos(a) * shift, this.p1[1] + Math.sin(a) * shift];
    this.after(0.6, () => {
      this.phase = "first";
      this.after(0.5, () => {
        this.phase = "blank";
        this.after(0.9, () => {
          this.phase = "second";
          this.setAnswersEnabled(true);
          this.after(0.5, () => {
            this.phase = "answer";
          });
        });
      });
    });
  }

  onAnswer(a: string | number) {
    if (this.phase !== "second" && this.phase !== "answer") return;
    const ok = (a === "same") === this.same;
    if (this.same) {
      this.sameTotal++;
      if (ok) this.sameCorrect++;
    } else {
      this.stair.record(ok);
    }
    this.feedback(ok);
    this.phase = "feedback";
    this.setAnswersEnabled(false);
    this.setStatus((ok ? "Right! " : "Not quite. ") + (this.same ? "It was the same place." : "It moved."));
    this.after(0.9, () => this.next());
  }

  onKey(e: KeyboardEvent) {
    if (e.repeat) return false;
    const k = e.key.toLowerCase();
    if (k === "s") this.onAnswer("same");
    else if (k === "d") this.onAnswer("moved");
    else return false;
    return true;
  }

  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = "#000000";
    g.fillRect(0, 0, this.width, this.height);
    if (!this.started || this.ended) return;
    fixation(g, this.width / 2, this.height / 2, 12);
    const r = this.lightR();
    if (this.phase === "first") sun(g, this.p1[0], this.p1[1], r);
    else if (this.phase === "second") sun(g, this.p2[0], this.p2[1], r);
    else if (this.phase === "feedback") {
      sun(g, this.p1[0], this.p1[1], r * 0.6);
      sun(g, this.p2[0], this.p2[1], r * 0.6);
    } else if (this.phase === "answer") this.drawPrompt(g, "Same place, or did it move?", this.height / 2 + 64);
  }

  summary() {
    if (this.stair.trials < 8) return { text: "Too few rounds to measure. Try a full session next time." };
    const th = this.stair.threshold();
    return {
      value: th,
      unit: "°",
      text: `You reliably notice a light moving by ${th.toFixed(2)}° or more.\nCorrect on "same place" rounds: ${this.sameCorrect} of ${this.sameTotal}.\n\nSmaller is better. If you missed many "same place" rounds, you may be answering "moved" too often.`,
    };
  }
}
