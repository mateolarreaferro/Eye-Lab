import {
  BETTER, bestFilterDay, dateAgo, filterMinutesOn, longestStreak, playsByGame, resultsFor, streak, today,
  type LabData, type Result,
} from "./lab";
import { GAMES } from "../app/catalog";

/*
  Reads of a player's data for Iris (get_progress, show_chart, export_data) and
  the progress page: trends per game, badges, chart series and CSV exports.
  Pure functions over LabData, no DOM, so they can be checked with made-up data.
*/

// --- badges -------------------------------------------------------------------------

export interface Badge {
  name: string;
  how: string;
  earned: boolean;
}

/** The badges on My progress, in display order. */
export function badges(data: LabData): Badge[] {
  const plays = playsByGame(data);
  const testsDone = ["acuity", "contrast", "field_map"].filter((t) => resultsFor(data, t).length > 0).length;
  const best = bestFilterDay(data);
  const longest = longestStreak(data);
  const goal = data.settings.dailyGoalMin;
  const list: [string, string, boolean][] = [
    ["First steps", "Play your first game", data.sessions.length >= 1],
    ["On a roll", "Play 3 days in a row", longest >= 3],
    ["Week warrior", "Play 7 days in a row", longest >= 7],
    ["Magic eyes", "30 minutes of filter time in a day", best >= 30],
    ["Full dose", "Reach your daily filter goal", best >= goal],
    ["Explorer", "Try 8 different games", Object.keys(plays).length >= 8],
    ["Scientist", "Finish all 3 eye check-up tests", testsDone >= 3],
    ["Trophy hunter", "Win 50 trophies", data.stars >= 50],
  ];
  return list.map(([name, how, earned]) => ({ name, how, earned }));
}

// --- trends ------------------------------------------------------------------------

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Whole days between a "YYYY-MM-DD" date and today. */
export function daysSince(date: string): number {
  const then = new Date(`${date}T12:00`).getTime();
  const now = new Date(`${today()}T12:00`).getTime();
  return Math.max(0, Math.round((now - then) / 86_400_000));
}

/** Result details without the bulky eye trace. */
function compactDetail(detail: Record<string, unknown>): Record<string, unknown> {
  const { trace: _trace, ...rest } = detail;
  return rest;
}

export interface GameTrend {
  game: string;
  title: string;
  unit: string;
  better: "higher" | "lower";
  sessions: number;
  first: { date: string; value: number };
  latest: { date: string; value: number; eye: string };
  best: { date: string; value: number };
  /** latest minus first. */
  change: number;
  /** null with fewer than two sessions. */
  improved: boolean | null;
  days_since_last: number;
  eyes_used: string[];
  /** Every session, oldest first (capped). */
  history: { date: string; value: number; eye: string; detail?: Record<string, unknown> }[];
}

export function gameTrend(data: LabData, id: string, full = false): GameTrend | null {
  const rows = resultsFor(data, id);
  if (rows.length === 0) return null;
  const better = BETTER[id] ?? "lower";
  const first = rows[0];
  const latest = rows[rows.length - 1];
  const best = rows.reduce((b, r) => ((better === "higher" ? r.value > b.value : r.value < b.value) ? r : b), first);
  const change = latest.value - first.value;
  const shown = rows.slice(full ? -60 : -30);
  const withDetail = full ? 5 : 1;
  return {
    game: id,
    title: first.title,
    unit: first.unit,
    better,
    sessions: rows.length,
    first: { date: first.date, value: round2(first.value) },
    latest: { date: latest.date, value: round2(latest.value), eye: latest.eye },
    best: { date: best.date, value: round2(best.value) },
    change: round2(change),
    improved: rows.length < 2 ? null : better === "higher" ? change > 0 : change < 0,
    days_since_last: daysSince(latest.date),
    eyes_used: [...new Set(rows.map((r) => r.eye))],
    history: shown.map((r, i) => ({
      date: r.date,
      value: round2(r.value),
      eye: r.eye,
      ...(i >= shown.length - withDetail && Object.keys(r.detail).length ? { detail: compactDetail(r.detail) } : {}),
    })),
  };
}

/** Everything Iris may need about the player; `game` narrows the trends to one game, in full. */
export function progressReport(data: LabData, game?: string | null) {
  const s = data.settings;
  const byDay = (days: number, value: (date: string) => number) =>
    Array.from({ length: days }, (_, i) => dateAgo(days - 1 - i)).map((date) => ({ date, value: round2(value(date)) }));
  const plays = playsByGame(data);
  const lastPlayed: Record<string, string> = {};
  for (const x of data.sessions) lastPlayed[x.id] = x.date;
  const ids = game ? [game] : [...new Set(data.results.map((r) => r.id))];
  const trends = ids.map((id) => gameTrend(data, id, !!game)).filter((t): t is GameTrend => t !== null);
  const week = Array.from({ length: 7 }, (_, i) => filterMinutesOn(data, dateAgo(i))).reduce((a, b) => a + b, 0);
  return {
    today: today(),
    player: {
      name: s.name,
      eye_being_tested: s.eye,
      distance_cm: s.distanceCm,
      screen_calibrated: s.pxPerCm > 0,
      daily_goal_min: s.dailyGoalMin,
      eye_tracking_during_games: s.eyeTracking,
    },
    totals: {
      trophies: data.stars,
      games_played: data.sessions.length,
      day_streak: streak(data),
      longest_streak: longestStreak(data),
      filter_minutes_today: round2(filterMinutesOn(data, today())),
      filter_minutes_last_7_days: round2(week),
      best_filter_day_min: round2(bestFilterDay(data)),
    },
    badges: badges(data),
    filter_minutes_by_day: byDay(14, (d) => filterMinutesOn(data, d)),
    trophies_by_day: byDay(14, (d) => data.sessions.filter((x) => x.date === d).reduce((a, x) => a + x.trophies, 0)),
    plays_by_game: plays,
    last_played: lastPlayed,
    never_played: GAMES.map((g) => g.key).filter((k) => !plays[k] && resultsFor(data, k).length === 0),
    better_direction: BETTER,
    trends,
    eye_tracking_sessions: data.sessions
      .filter((x) => x.eye)
      .slice(-8)
      .map((x) => ({ date: x.date, game: x.id, ...x.eye })),
  };
}

// --- charts -------------------------------------------------------------------------

export type ChartKind = "results" | "filter_time" | "trophies" | "plays";

export interface ChartSpec {
  kind: ChartKind;
  game?: string | null;
  days?: number | null;
}

export interface ChartPoint {
  date: string;
  value: number;
}

export interface ChartData {
  title: string;
  subtitle: string;
  unit: string;
  form: "line" | "bars";
  points: ChartPoint[];
  /** For result lines: which way is better. */
  better?: "higher" | "lower";
  /** For filter time: the daily goal, drawn as a line. */
  goal?: number;
}

const clampDays = (d: number | null | undefined) => Math.min(90, Math.max(7, Math.round(d ?? 14)));

/** The series behind a chart Iris asks for, or why there isn't one. */
export function chartData(data: LabData, spec: ChartSpec): ChartData | { error: string } {
  const days = clampDays(spec.days);
  const span = Array.from({ length: days }, (_, i) => dateAgo(days - 1 - i));
  switch (spec.kind) {
    case "results": {
      const game = GAMES.find((g) => g.key === spec.game);
      if (!game) return { error: `Unknown game '${spec.game ?? ""}'. Pass one of: ${GAMES.map((g) => g.key).join(", ")}.` };
      const rows = resultsFor(data, game.key).slice(-30);
      if (rows.length === 0) return { error: `No results for ${game.name} yet.` };
      const better = BETTER[game.key] ?? "lower";
      return {
        title: game.name,
        subtitle: `${rows.length} ${rows.length === 1 ? "session" : "sessions"}, ${better} is better`,
        unit: rows[0].unit,
        form: "line",
        better,
        points: rows.map((r) => ({ date: r.date, value: round2(r.value) })),
      };
    }
    case "filter_time":
      return {
        title: "Filter time",
        subtitle: `Minutes a day, last ${days} days, goal ${data.settings.dailyGoalMin} min`,
        unit: "min",
        form: "bars",
        goal: data.settings.dailyGoalMin,
        points: span.map((date) => ({ date, value: round2(filterMinutesOn(data, date)) })),
      };
    case "trophies":
      return {
        title: "Trophies",
        subtitle: `Won each day, last ${days} days`,
        unit: "trophies",
        form: "bars",
        points: span.map((date) => ({ date, value: data.sessions.filter((x) => x.date === date).reduce((a, x) => a + x.trophies, 0) })),
      };
    case "plays":
      return {
        title: "Games played",
        subtitle: `Each day, last ${days} days`,
        unit: "games",
        form: "bars",
        points: span.map((date) => ({ date, value: data.sessions.filter((x) => x.date === date).length })),
      };
    default:
      return { error: `Unknown chart kind '${String(spec.kind)}'.` };
  }
}

/** A sentence Iris can read back after a chart is drawn. */
export function describeChart(c: ChartData): string {
  const vals = c.points.map((p) => p.value);
  if (c.form === "line") {
    const first = c.points[0];
    const last = c.points[c.points.length - 1];
    return `Chart shown: ${c.title}, ${c.points.length} sessions from ${first.date} (${first.value} ${c.unit}) to ${last.date} (${last.value} ${c.unit}); best ${
      c.better === "higher" ? Math.max(...vals) : Math.min(...vals)
    } ${c.unit}; ${c.better} is better.`;
  }
  const total = round2(vals.reduce((a, b) => a + b, 0));
  const active = vals.filter((v) => v > 0).length;
  return `Chart shown: ${c.title}, ${c.points.length} days, total ${total} ${c.unit}, ${active} active days${c.goal ? `, goal ${c.goal} ${c.unit} a day` : ""}.`;
}

// --- exports ------------------------------------------------------------------------

export type ExportKind = "results" | "sessions" | "filter_time";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\n");

/** The player's data as CSV text. */
export function exportCsv(data: LabData, what: ExportKind): string {
  switch (what) {
    case "results":
      return csv([
        ["date", "time", "game", "title", "value", "unit", "eye", "detail"],
        ...data.results.map((r: Result) => [r.date, new Date(r.time * 1000).toISOString(), r.id, r.title, r.value, r.unit, r.eye, compactDetail(r.detail)]),
      ]);
    case "sessions":
      return csv([
        ["date", "game", "title", "trophies", "eyes_tracked_share", "eye_fps", "eye_seconds", "osc_hz", "osc_pp_deg"],
        ...data.sessions.map((x) => [x.date, x.id, x.title, x.trophies, x.eye?.tracked, x.eye?.fps, x.eye?.seconds, x.eye?.oscHz, x.eye?.oscPpDeg]),
      ]);
    case "filter_time": {
      const dates = [...new Set([...Object.keys(data.filterSeconds), ...Object.keys(data.helperSeconds)])].sort();
      return csv([
        ["date", "page_minutes", "helper_minutes", "total_minutes"],
        ...dates.map((d) => [d, round2((data.filterSeconds[d] ?? 0) / 60), round2((data.helperSeconds[d] ?? 0) / 60), round2(filterMinutesOn(data, d))]),
      ]);
    }
  }
}
