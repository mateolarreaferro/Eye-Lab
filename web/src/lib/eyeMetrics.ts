/*
  Analysis for the Eye movement test, kept free of the DOM so it can be checked
  with synthetic signals. Input is gaze in degrees of visual angle (x right,
  y down, 0 at the screen centre) with timestamps in seconds.

  The thresholds below are first guesses, not tuned on Prakash recordings yet.
*/

/** A gaze signal only counts as a regular oscillation when its spectral peak
 * stands this far above the median of the band... */
export const OSC_PROMINENCE = 3;
/** ...and is at least this big, peak to peak, in degrees (webcam noise is around 1 degree). */
export const OSC_MIN_PP_DEG = 1;
/** Band searched for oscillation, in Hz. Clinical nystagmus is mostly 1-8 Hz. */
export const OSC_BAND: [number, number] = [1, 8];

export interface Linear {
  a: number; // offset
  b: number; // slope
}

export const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export function sd(xs: number[]) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Least-squares line y = a + b x. */
export function fitLine(xs: number[], ys: number[]): Linear & { r: number } {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const b = sxx > 0 ? sxy / sxx : 0;
  return { a: my - b * mx, b, r: sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0 };
}

// --- calibration -------------------------------------------------------------------

/** One calibration hold: where the target was (degrees) and the raw eye
 * readings taken while the child looked at it (eye widths, camera axes). */
export interface Hold {
  target: number;
  raw: number[];
}

/**
 * Maps raw readings to degrees for one axis from the target holds. The median
 * of each hold makes it tolerant of nystagmus and blinks. Returns null when the
 * holds don't separate cleanly (child looked elsewhere, tracking too noisy).
 */
export function calibrateAxis(holds: Hold[]): Linear | null {
  const pts = holds.filter((h) => h.raw.length >= 5).map((h) => ({ t: h.target, m: median(h.raw) }));
  const targets = new Set(pts.map((p) => p.t));
  if (targets.size < 2) return null;
  // raw = a + b * deg, inverted below.
  const fit = fitLine(pts.map((p) => p.t), pts.map((p) => p.m));
  if (Math.abs(fit.r) < 0.9 || fit.b === 0) return null;
  // Noise check: the spread inside holds must be small against the span between them.
  const span = Math.abs(fit.b) * (Math.max(...targets) - Math.min(...targets));
  const noise = median(holds.filter((h) => h.raw.length >= 5).map((h) => mad(h.raw)));
  if (span < 4 * noise) return null;
  return { a: -fit.a / fit.b, b: 1 / fit.b };
}

/** Median absolute deviation. */
export function mad(xs: number[]) {
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

/**
 * Fallback when calibration fails: an eyeball of 12 mm radius in an eye opening
 * about 28 mm wide moves the iris 0.43 eye widths per radian. Horizontal sign is
 * flipped because the camera faces the child (looking to the screen's right
 * moves the iris to the camera image's left).
 */
export const ANATOMICAL: { x: Linear; y: Linear } = {
  x: { a: 0, b: -(180 / Math.PI) / 0.43 },
  y: { a: 0, b: (180 / Math.PI) / 0.43 },
};

// --- resampling ----------------------------------------------------------------------

/**
 * Linear interpolation onto a uniform grid at `hz`. Gaps (lost tracking, blinks)
 * are bridged; `gapFraction` says how much of the grid was bridged across gaps
 * longer than 0.15 s.
 */
export function resample(ts: number[], xs: number[], hz: number, t0 = ts[0], t1 = ts[ts.length - 1]) {
  const out: number[] = [];
  const grid: number[] = [];
  let j = 0;
  let bridged = 0;
  for (let t = t0; t <= t1 + 1e-9; t += 1 / hz) {
    while (j < ts.length - 2 && ts[j + 1] < t) j++;
    const ta = ts[j];
    const tb = ts[Math.min(j + 1, ts.length - 1)];
    const u = tb > ta ? Math.min(1, Math.max(0, (t - ta) / (tb - ta))) : 0;
    out.push(xs[j] + (xs[Math.min(j + 1, xs.length - 1)] - xs[j]) * u);
    grid.push(t);
    if (tb - ta > 0.15) bridged++;
  }
  return { t: grid, x: out, gapFraction: grid.length ? bridged / grid.length : 1 };
}

/** Subtracts a centred moving average of `win` samples (removes slow drift). */
export function detrend(xs: number[], win: number) {
  const h = Math.max(1, Math.floor(win / 2));
  return xs.map((x, i) => {
    const lo = Math.max(0, i - h);
    const hi = Math.min(xs.length, i + h + 1);
    let s = 0;
    for (let k = lo; k < hi; k++) s += xs[k];
    return x - s / (hi - lo);
  });
}

// --- measures ------------------------------------------------------------------------

export interface Stability {
  sdX: number;
  sdY: number;
  /** Bivariate contour ellipse area holding 68% of gaze points, in square degrees. */
  bcea: number;
}

export function stability(xs: number[], ys: number[]): Stability {
  const sdX = sd(xs);
  const sdY = sd(ys);
  const r = fitLine(xs, ys).r;
  return { sdX, sdY, bcea: 2.291 * Math.PI * sdX * sdY * Math.sqrt(Math.max(0, 1 - r * r)) };
}

export interface Oscillation {
  found: boolean;
  /** Frequency of the biggest peak in the band, Hz. */
  hz: number;
  /** Its size, peak to peak, in degrees. */
  ppDeg: number;
  prominence: number;
}

/**
 * Looks for a regular back-and-forth movement in a uniformly sampled signal:
 * drift removed with a 1 s moving average, Hann window, then the amplitude
 * spectrum from 1 to 8 Hz (capped below the Nyquist limit of the camera).
 */
export function oscillation(xs: number[], hz: number): Oscillation {
  const n = xs.length;
  const none = { found: false, hz: NaN, ppDeg: NaN, prominence: 0 };
  if (n < hz * 3) return none;
  const d = detrend(xs, Math.round(hz));
  const w = d.map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  const wsum = w.reduce((s, v) => s + v, 0);
  const top = Math.min(OSC_BAND[1], hz / 2.5);
  const amps: { f: number; a: number }[] = [];
  for (let f = OSC_BAND[0]; f <= top + 1e-9; f += 0.05) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const ph = (2 * Math.PI * f * i) / hz;
      re += w[i] * d[i] * Math.cos(ph);
      im -= w[i] * d[i] * Math.sin(ph);
    }
    amps.push({ f, a: (2 * Math.hypot(re, im)) / wsum });
  }
  if (!amps.length) return none;
  // The 1 s moving average leaks a little below 1.5 Hz; the peak is still right.
  const peak = amps.reduce((p, q) => (q.a > p.a ? q : p));
  const floor = median(amps.map((p) => p.a));
  const prominence = floor > 0 ? peak.a / floor : 0;
  const ppDeg = 2 * peak.a;
  return { found: prominence >= OSC_PROMINENCE && ppDeg >= OSC_MIN_PP_DEG, hz: peak.f, ppDeg, prominence };
}

export interface Pursuit {
  /** Eye speed over target speed (1 = kept up exactly). */
  gain: number;
  /** How far the eye trails the target, ms. */
  lagMs: number;
  /** Correlation between eye and (shifted) target, 0..1. */
  r: number;
}

/** Gain and lag of smooth pursuit, both uniformly sampled at `hz`. Tries lags of 0-500 ms. */
export function pursuit(eye: number[], target: number[], hz: number): Pursuit {
  let best: Pursuit = { gain: NaN, lagMs: NaN, r: -Infinity };
  const maxLag = Math.round(0.5 * hz);
  for (let lag = 0; lag <= maxLag; lag++) {
    const e = eye.slice(lag);
    const tg = target.slice(0, target.length - lag);
    if (e.length < hz * 2) break;
    const fit = fitLine(tg, e);
    if (fit.r > best.r) best = { gain: fit.b, lagMs: (lag / hz) * 1000, r: fit.r };
  }
  return best;
}
