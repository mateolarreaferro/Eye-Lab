import type { Icon } from "@phosphor-icons/react";
import { pxPerDeg } from "../lib/lab";
import { play } from "../lib/sfx";

/*
  Base for every game and test. Mirrors eye_lab/core/exercise.gd so the ports
  stay line-for-line comparable: override the hooks, call the helpers.

  The stimulus is drawn on a canvas inside the filtered stage, in CSS pixels
  (this.width x this.height). Everything else (Home, trophies, status, answer
  buttons, the how-to-play and result cards) is chrome that ExerciseShell draws
  outside the filter, so it stays readable.

  Hooks:   setup() begin() draw(g) tick(dt) onAnswer(id) onPointer(p) onKey(e) summary()
  Helpers: ppd() setStatus() setAnswers() setAnswersEnabled() feedback(ok) after(sec, fn) end()
*/

export interface AnswerOption {
  id: string | number;
  text: string;
  /** A Phosphor icon component shown above the label. */
  icon?: Icon;
  /** Or a custom drawing (e.g. a tumbling E) in a size x size box, ink colour given. */
  glyph?: (g: CanvasRenderingContext2D, size: number, ink: string) => void;
  tip?: string;
}

export interface StagePointer {
  type: "down" | "move" | "up";
  x: number;
  y: number;
}

export interface Summary {
  /** Logged to test history when present. Leave out when too few trials ran. */
  value?: number;
  unit?: string;
  text: string;
  detail?: Record<string, unknown>;
}

export abstract class Exercise {
  id = "";
  title = "";
  /** "How to play" steps shown before the game starts. */
  steps: string[] = [];
  /** Optional note under the steps. */
  instructions = "";
  config: Record<string, unknown> = {};
  accent = "#f07a2b";

  trophies = 0;
  started = false;
  ended = false;
  width = 0;
  height = 0;
  /** Seconds since begin(). */
  time = 0;

  status = "";
  answers: AnswerOption[] = [];
  answersEnabled = true;
  answerSize = { w: 120, h: 104 };

  flashColor = "";
  flashT = 0;

  private timers = new Set<number>();
  private listener: (() => void) | null = null;
  /** Set by the shell: called when the game ends. */
  onEnd: (() => void) | null = null;

  // --- hooks ---------------------------------------------------------------------

  setup(): void {}
  begin(): void {}
  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = "#1c1b1a";
    g.fillRect(0, 0, this.width, this.height);
  }
  tick(_dt: number): void {}
  onAnswer(_id: string | number): void {}
  onPointer(_p: StagePointer): void {}
  /** Return true if the key was used. */
  onKey(_e: KeyboardEvent): boolean {
    return false;
  }
  summary(): Summary | null {
    return null;
  }

  // --- helpers --------------------------------------------------------------------

  /** CSS pixels per degree of visual angle. */
  ppd(): number {
    return pxPerDeg();
  }

  setStatus(t: string) {
    this.status = t;
    this.changed();
  }

  setAnswers(options: AnswerOption[], size = { w: 120, h: 104 }) {
    this.answers = options;
    this.answerSize = size;
    this.changed();
  }

  setAnswersEnabled(on: boolean) {
    this.answersEnabled = on;
    this.changed();
  }

  /** Sound, a brief green or red flash over the stimulus, and a trophy when right. */
  feedback(ok: boolean) {
    play(ok ? "success" : "fail");
    this.flashT = 0.25;
    this.flashColor = ok ? "51, 230, 89" : "242, 51, 51";
    if (ok) this.trophies++;
    this.changed();
  }

  /** Run fn after sec seconds; cancelled automatically when the game ends. */
  after(sec: number, fn: () => void) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      if (!this.ended) fn();
    }, Math.max(1, sec * 1000));
    this.timers.add(id);
  }

  end() {
    if (this.ended) return;
    this.ended = true;
    this.dispose();
    this.onEnd?.();
  }

  dispose() {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers.clear();
  }

  /** Centred prompt text drawn into the scene (e.g. "How many lights?"). */
  drawPrompt(g: CanvasRenderingContext2D, text: string, y: number, color = "#d9dde5", size = 24) {
    g.save();
    g.fillStyle = color;
    g.font = `500 ${size}px "Figtree Variable", system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, this.width / 2, y);
    g.restore();
  }

  // --- shell plumbing --------------------------------------------------------------

  subscribe(fn: () => void) {
    this.listener = fn;
  }

  protected changed() {
    this.listener?.();
  }
}

/** Uniform random helpers used across the games. */
export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
export const randi = (lo: number, hi: number) => Math.floor(rand(lo, hi + 1));
export const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
