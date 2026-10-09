import { createStore, loadJSON, saveJSON } from "./store";
import { pxPerDeg } from "./lab";

/*
  The vision filter: off, high-pass ("frequency patching") or low-pass, plus the
  sliders from Settings > Filters. In the page it is an SVG filter applied to
  the stage (filter/FilterDefs.tsx); with Whole screen on, the macOS helper
  filters everything instead (lib/helper.ts) and the page filter steps aside so
  nothing is filtered twice.

  lod is the blur scale as in the desktop app and the helper: 2^lod physical
  pixels, higher = coarser cutoff. hp_gain boosts the contrast of what high-pass
  leaves, hp_keep keeps a share of the coarse image (0 = pure high-pass), and
  lp_mix blends low-pass from the original (0) to fully blurred (1).
*/

export const MODES = ["off", "high_pass", "low_pass"] as const;
export type Mode = 0 | 1 | 2;
export const MODE_NAMES = ["Off", "High-pass", "Low-pass"];
export const MODE_TIPS = [
  "No filter",
  "Removes coarse shapes and keeps fine detail. This is the \"frequency patching\" filter.",
  "Blurs away fine detail and keeps coarse shapes",
];

export interface FilterParams {
  hp_lod: number;
  hp_gain: number;
  hp_keep: number;
  lp_lod: number;
  lp_mix: number;
}

export const DEFAULT_PARAMS: FilterParams = { hp_lod: 3, hp_gain: 1.6, hp_keep: 0, lp_lod: 3, lp_mix: 1 };

export const LIMITS: Record<keyof FilterParams, [number, number]> = {
  hp_lod: [0.5, 7], lp_lod: [0.5, 7], hp_gain: [0.5, 4], hp_keep: [0, 1], lp_mix: [0, 1],
};

interface FilterState {
  mode: Mode;
  params: FilterParams;
  wholeScreen: boolean;
}

const KEY = "eyelab:filter";

export const filter = createStore<FilterState>({
  mode: 0,
  params: { ...DEFAULT_PARAMS, ...loadJSON<Partial<FilterParams>>(KEY, {}) },
  wholeScreen: false,
});
filter.subscribe(() => saveJSON(KEY, filter.get().params));

export const useFilter = filter.use;

export function setMode(mode: Mode) {
  filter.set((s) => ({ ...s, mode }));
}

export function setParam(key: keyof FilterParams, value: number) {
  const [lo, hi] = LIMITS[key];
  filter.set((s) => ({ ...s, params: { ...s.params, [key]: Math.min(hi, Math.max(lo, value)) } }));
}

export function resetParams() {
  filter.set((s) => ({ ...s, params: { ...DEFAULT_PARAMS } }));
}

/** Cutoff key for a mode: high-pass and low-pass each keep their own. */
export const lodKey = (mode: Mode): "hp_lod" | "lp_lod" => (mode === 2 ? "lp_lod" : "hp_lod");

/** Cutoff of the current filter (the filter bar slider and Iris use this). */
export function setCutoff(lod: number) {
  setParam(lodKey(filter.get().mode), lod);
}

const dpr = () => window.devicePixelRatio || 1;

/** Gaussian sigma in CSS pixels for a blur scale, matching the helper's 0.8 * 2^lod physical px. */
export const sigmaFor = (lod: number) => (0.8 * Math.pow(2, lod)) / dpr();

/** Approximate cutoff in cycles per degree for a blur scale. */
export const lodToCpd = (lod: number) => (pxPerDeg() * dpr()) / Math.pow(2, lod + 1);
