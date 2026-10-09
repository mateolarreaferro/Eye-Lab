import { createStore, loadJSON, saveJSON } from "./store";

/*
  The player's data, kept in this browser's localStorage under one key:
  settings, test results, finished sessions, trophies and daily filter time.
  Port of eye_lab/autoload/lab.gd. The whole-screen helper logs its own filter
  seconds, which lib/helper.ts reads and adds in through `helperSeconds`.
*/

export type Eye = "Both" | "Left" | "Right";

export interface Settings {
  distanceCm: number; // at 57 cm, 1 cm on screen is about 1 degree
  pxPerCm: number; // 0 = not calibrated yet
  dailyGoalMin: number;
  eye: Eye;
  name: string;
  sound: boolean;
}

export interface Result {
  time: number;
  date: string;
  id: string;
  title: string;
  value: number;
  unit: string;
  eye: Eye;
  detail: Record<string, unknown>;
}

export interface Session {
  date: string;
  id: string;
  title: string;
  trophies: number;
}

interface LabData {
  settings: Settings;
  results: Result[];
  sessions: Session[];
  stars: number;
  filterSeconds: Record<string, number>;
  helperSeconds: Record<string, number>;
}

const KEY = "eyelab:v1";

const DEFAULT_SETTINGS: Settings = {
  distanceCm: 57,
  pxPerCm: 0,
  dailyGoalMin: 120,
  eye: "Both",
  name: "",
  sound: true,
};

function load(): LabData {
  const d = loadJSON<Partial<LabData>>(KEY, {});
  return {
    settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
    results: d.results ?? [],
    sessions: d.sessions ?? [],
    stars: d.stars ?? 0,
    filterSeconds: d.filterSeconds ?? {},
    helperSeconds: d.helperSeconds ?? {},
  };
}

export const lab = createStore<LabData>(load());

let saveTimer = 0;
lab.subscribe(() => {
  // Filter time ticks every second; batch writes instead of saving each change.
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => saveJSON(KEY, lab.get()), 400);
});
window.addEventListener("pagehide", () => saveJSON(KEY, lab.get()));

export const useLab = lab.use;

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  lab.set((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
}

// --- dates ------------------------------------------------------------------

/** Local "YYYY-MM-DD" for `daysAgo` days before today. */
export function dateAgo(daysAgo = 0): string {
  const t = new Date();
  t.setDate(t.getDate() - daysAgo);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

export const today = () => dateAgo(0);

// --- filter time ----------------------------------------------------------------

export function addFilterTime(seconds: number) {
  const d = today();
  lab.set((s) => ({ ...s, filterSeconds: { ...s.filterSeconds, [d]: (s.filterSeconds[d] ?? 0) + seconds } }));
}

export function filterMinutesOn(data: LabData, date: string): number {
  return ((data.filterSeconds[date] ?? 0) + (data.helperSeconds[date] ?? 0)) / 60;
}

// --- sessions, results, streaks -----------------------------------------------------

export function recordSession(id: string, title: string, trophies: number) {
  lab.set((s) => ({
    ...s,
    sessions: [...s.sessions, { date: today(), id, title, trophies }],
    stars: s.stars + trophies,
  }));
}

export function logResult(id: string, title: string, value: number, unit: string, detail: Record<string, unknown> = {}) {
  lab.set((s) => ({
    ...s,
    results: [...s.results, { time: Date.now() / 1000, date: today(), id, title, value, unit, eye: s.settings.eye, detail }],
  }));
}

export const resultsFor = (data: LabData, id: string) => data.results.filter((r) => r.id === id);

function activeOn(data: LabData, date: string) {
  return data.sessions.some((s) => s.date === date) || filterMinutesOn(data, date) >= 1;
}

/** Days in a row with a game or a minute of filter time, ending today (or yesterday). */
export function streak(data: LabData): number {
  const start = activeOn(data, today()) ? 0 : 1;
  let n = 0;
  while (activeOn(data, dateAgo(start + n))) n++;
  return n;
}

export function longestStreak(data: LabData): number {
  let best = 0;
  let run = 0;
  for (let i = 365; i >= 0; i--) {
    run = activeOn(data, dateAgo(i)) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function bestFilterDay(data: LabData): number {
  let best = 0;
  for (let i = 0; i <= 365; i++) best = Math.max(best, filterMinutesOn(data, dateAgo(i)));
  return best;
}

export function playsByGame(data: LabData): Record<string, number> {
  const d: Record<string, number> = {};
  for (const s of data.sessions) d[s.id] = (d[s.id] ?? 0) + 1;
  return d;
}

export const BETTER: Record<string, "higher" | "lower"> = {
  acuity: "lower", contrast: "higher", field_map: "higher", mot: "higher", pong: "higher",
  search: "lower", spot_count: "lower", location: "lower", odd_color: "lower", odd_acuity: "lower",
  odd_orientation: "lower", odd_depth: "lower",
};

/** Snapshot for the progress page and Iris's get_progress tool. */
export function progressSummary(data = lab.get()) {
  const week = [];
  for (let i = 6; i >= 0; i--) {
    week.push({ date: dateAgo(i), filter_minutes: Math.round(filterMinutesOn(data, dateAgo(i)) * 10) / 10 });
  }
  const latest: Record<string, unknown> = {};
  for (const r of data.results) {
    latest[r.id] = {
      title: r.title, value: Math.round(r.value * 100) / 100, unit: r.unit, date: r.date,
      sessions_logged: resultsFor(data, r.id).length,
    };
  }
  return {
    name: data.settings.name,
    trophies_total: data.stars,
    day_streak: streak(data),
    games_played_total: data.sessions.length,
    plays_by_game: playsByGame(data),
    filter_minutes_today: Math.round(filterMinutesOn(data, today()) * 10) / 10,
    daily_filter_goal_minutes: data.settings.dailyGoalMin,
    filter_minutes_last_7_days: week,
    latest_results: latest,
    better_direction: BETTER,
    screen_calibrated: data.settings.pxPerCm > 0,
  };
}

// --- visual angle -----------------------------------------------------------------

/** A browser can't read the screen's physical size, so until the card calibration
 * runs this assumes the CSS reference pixel (96 per inch). */
export const ESTIMATED_PX_PER_CM = 96 / 2.54;

export const isCalibrated = () => lab.get().settings.pxPerCm > 0;

export function pxPerCm(): number {
  const s = lab.get().settings;
  return s.pxPerCm > 0 ? s.pxPerCm : ESTIMATED_PX_PER_CM;
}

/** CSS pixels per degree of visual angle at the configured viewing distance. */
export function pxPerDeg(): number {
  return pxPerCm() * lab.get().settings.distanceCm * Math.tan(Math.PI / 180);
}
