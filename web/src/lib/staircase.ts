/**
 * Adaptive N-down-1-up staircase with multiplicative steps.
 * 2-down converges on about 71% correct, 3-down on about 79%.
 * Port of eye_lab/core/staircase.gd.
 */
export class Staircase {
  reversals: number[] = [];
  trials = 0;
  correct = 0;
  private run = 0;
  private lastDir = 0;

  constructor(
    public value: number,
    public min: number,
    public max: number,
    public step = 1.4,
    public largerIsEasier = true,
    public down = 2,
  ) {}

  record(wasCorrect: boolean) {
    this.trials++;
    if (wasCorrect) {
      this.correct++;
      if (++this.run >= this.down) {
        this.run = 0;
        this.move(-1);
      }
    } else {
      this.run = 0;
      this.move(1);
    }
  }

  /** dir -1 = harder, +1 = easier. Big steps until two reversals, then finer ones. */
  private move(dir: number) {
    if (this.lastDir !== 0 && dir !== this.lastDir) this.reversals.push(this.value);
    this.lastDir = dir;
    const f = this.reversals.length < 2 ? this.step : Math.sqrt(this.step);
    const grow = (dir === 1) === this.largerIsEasier;
    this.value = Math.min(this.max, Math.max(this.min, grow ? this.value * f : this.value / f));
  }

  /** Geometric mean of the last (up to) six reversals; the current value if too few. */
  threshold(): number {
    if (this.reversals.length < 2) return this.value;
    const last = this.reversals.slice(-6);
    return Math.exp(last.reduce((s, v) => s + Math.log(v), 0) / last.length);
  }

  accuracy(): number {
    return this.correct / Math.max(this.trials, 1);
  }
}
