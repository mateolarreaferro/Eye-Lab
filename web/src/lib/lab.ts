import { createStore, loadJSON, saveJSON } from "./store";

/*
  Each player's data, kept in this browser's localStorage under one key per
  player (eyelab:v1:<id>): settings, test results, finished sessions, trophies
  and daily filter time. The player list is eyelab:players. Screen settings
  (distance, calibration) and sound belong to the device, not the player, and
  live in eyelab:device. Port of eye_lab/autoload/lab.gd. The whole-screen
  helper logs its own filter seconds, which lib/helper.ts reads and adds in
  through `helperSeconds`.
*/

export type Eye = "Both" | "Left" | "Right";

export interface Settings {
  distanceCm: number; // at 57 cm, 1 cm on screen is about 1 degree
  pxPerCm: number; // 0 = not calibrated yet
  dailyGoalMin: number;
  eye: Eye;
  name: string;
  sound: boolean;
  /** Record the eyes with the webcam during games. */
  eyeTracking: boolean;
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

/** What eye tracking saw during one game. */
export interface EyeSummary {
  /** Share of camera frames with both eyes open and found, 0..1. */
  tracked: number;
  fps: number;
  seconds: number;
  /** Regular back-and-forth movement, when one stood out. */
  oscHz: number | null;
  oscPpDeg: number | null;
}

export interface Session {
  date: string;
  id: string;
  title: string;
  trophies: number;
  eye?: EyeSummary;
}

interface LabData {
  settings: Settings;
  results: Result[];
  sessions: Session[];
  stars: number;
  filterSeconds: Record<string, number>;
  helperSeconds: Record<string, number>;
}

export interface Player {
  id: string;
  name: string;
  /** Last time this player was picked (ms), for ordering the picker. */
  lastSeen: number;
}

const OLD_KEY = "eyelab:v1";
const PLAYERS_KEY = "eyelab:players";
const DEVICE_KEY = "eyelab:device";
const playerKey = (id: string) => `${OLD_KEY}:${id}`;
const DEVICE_SETTINGS = ["distanceCm", "pxPerCm", "sound"] as const;

const DEFAULT_SETTINGS: Settings = {
  distanceCm: 57,
  pxPerCm: 0,
  dailyGoalMin: 120,
  eye: "Both",
  name: "",
  sound: true,
  eyeTracking: false,
};

function load(id: string | null): LabData {
  const d = id ? loadJSON<Partial<LabData>>(playerKey(id), {}) : {};
  const device = loadJSON<Partial<Settings>>(DEVICE_KEY, {});
  return {
    settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}), ...device },
    results: d.results ?? [],
    sessions: d.sessions ?? [],
    stars: d.stars ?? 0,
    filterSeconds: d.filterSeconds ?? {},
    helperSeconds: d.helperSeconds ?? {},
  };
}

/** Before players existed everything sat under eyelab:v1; that becomes the first player. */
function migrate(): Player[] {
  const list = loadJSON<Player[] | null>(PLAYERS_KEY, null);
  if (list) return list;
  const old = loadJSON<Partial<LabData> | null>(OLD_KEY, null);
  if (!old) return [];
  const id = newId();
  const name = old.settings?.name?.trim() || "Player 1";
  const device: Partial<Settings> = {};
  for (const k of DEVICE_SETTINGS) if (old.settings && k in old.settings) Object.assign(device, { [k]: old.settings[k] });
  saveJSON(DEVICE_KEY, device);
  saveJSON(playerKey(id), { ...old, settings: { ...old.settings, name } });
  const players = [{ id, name, lastSeen: Date.now() }];
  saveJSON(PLAYERS_KEY, players);
  return players;
}

const newId = () => Math.random().toString(36).slice(2, 10);

/** The players on this device, and who is playing now (null until someone is picked). */
export const players = createStore<{ list: Player[]; current: string | null }>({ list: migrate(), current: null });
export const usePlayers = players.use;

export const lab = createStore<LabData>(load(null));

function save() {
  const id = players.get().current;
  if (!id) return;
  const d = lab.get();
  const device: Record<string, unknown> = {};
  for (const k of DEVICE_SETTINGS) device[k] = d.settings[k];
  saveJSON(DEVICE_KEY, device);
  saveJSON(playerKey(id), d);
}

let saveTimer = 0;
lab.subscribe(() => {
  // Filter time ticks every second; batch writes instead of saving each change.
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(save, 400);
});
window.addEventListener("pagehide", save);

/** Switch to a player: saves the current one first. */
export function choosePlayer(id: string) {
  window.clearTimeout(saveTimer);
  save();
  players.set((p) => {
    const list = p.list.map((x) => (x.id === id ? { ...x, lastSeen: Date.now() } : x));
    saveJSON(PLAYERS_KEY, list);
    return { list, current: id };
  });
  lab.set(load(id));
}

export function addPlayer(name: string) {
  const id = newId();
  const clean = name.trim().slice(0, 40);
  saveJSON(playerKey(id), { settings: { name: clean } });
  players.set((p) => {
    const list = [...p.list, { id, name: clean, lastSeen: Date.now() }];
    saveJSON(PLAYERS_KEY, list);
    return { ...p, list };
  });
  choosePlayer(id);
}

/** Back to the picker (the current player's data is saved first). */
export function leavePlayer() {
  window.clearTimeout(saveTimer);
  save();
  players.set((p) => ({ ...p, current: null }));
}

export function removePlayer(id: string) {
  if (players.get().current === id) leavePlayer();
  try {
    localStorage.removeItem(playerKey(id));
  } catch {
    /* storage unavailable */
  }
  players.set((p) => {
    const list = p.list.filter((x) => x.id !== id);
    saveJSON(PLAYERS_KEY, list);
    return { ...p, list };
  });
}

export const useLab = lab.use;

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  lab.set((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
}

/** Renames the current player (Settings > General). */
export function renamePlayer(name: string) {
  setSetting("name", name);
  const id = players.get().current;
  players.set((p) => {
    const list = p.list.map((x) => (x.id === id ? { ...x, name } : x));
    saveJSON(PLAYERS_KEY, list);
    return { ...p, list };
  });
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

export function recordSession(id: string, title: string, trophies: number, eye?: EyeSummary) {
  lab.set((s) => ({
    ...s,
    sessions: [...s.sessions, { date: today(), id, title, trophies, ...(eye ? { eye } : {}) }],
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
  odd_orientation: "lower", odd_depth: "lower", eye_movement: "lower",
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
