import { createStore, loadJSON, saveJSON } from "./store";
import { CALIBRATE, GAMES, gameByKey } from "../app/catalog";
import { nav, openGame, openPanel, openTab, type SettingsTab } from "./nav";
import { MODES, MODE_NAMES, filter, lodKey, lodToCpd, resetParams, setCutoff, setMode, setParam, type Mode } from "./filter";
import { helper, setWholeScreen } from "./helper";
import { filterMinutesOn, lab, setSetting, streak, today, type Eye } from "./lab";
import { chartData, describeChart, exportCsv, progressReport, type ChartData, type ChartKind, type ExportKind } from "./report";
import { downloadCsv } from "./sessionEyes";

/*
  Iris, the Eye Lab guide, powered by Claude. The page sends the conversation
  plus a short "Right now" context (date, player, screen, filter, settings) to
  the Eye Lab server (iris-server/ in the Eye-Lab repo), which holds Iris's
  system prompt and tool definitions; the tools run here, against the stores.
  The player's own Claude API key (Settings > Iris) goes with each request as
  x-anthropic-key and is used by the server for that request only. It is kept
  in this browser's localStorage, apart from the progress data, so get_progress
  never sees it.
*/

const SERVER = import.meta.env.VITE_IRIS_API ?? "https://eye-lab-iris.vercel.app/api/iris";
const KEY_STORE = "eyelab:iris-key";
const MAX_TOOL_ROUNDS = 8;

type Block = { type: string; [k: string]: unknown };
export interface Message {
  role: "user" | "assistant";
  content: string | Block[];
}

/** What the chat shows: text bubbles, and charts Iris draws. */
export type Bubble = { kind: "text"; mine: boolean; text: string } | { kind: "chart"; chart: ChartData };

interface IrisState {
  apiKey: string;
  messages: Message[];
  bubbles: Bubble[];
  busy: boolean;
}

export const iris = createStore<IrisState>({
  apiKey: loadJSON<string>(KEY_STORE, ""),
  messages: [],
  bubbles: [],
  busy: false,
});

export function setApiKey(key: string) {
  saveJSON(KEY_STORE, key.trim());
  iris.set((s) => ({ ...s, apiKey: key.trim(), messages: [], bubbles: [] }));
}

export const keySource = (): "own" | "none" => (iris.get().apiKey ? "own" : "none");

const say = (text: string, mine = false) => iris.set((s) => ({ ...s, bubbles: [...s.bubbles, { kind: "text", mine, text }] }));
const show = (chart: ChartData) => iris.set((s) => ({ ...s, bubbles: [...s.bubbles, { kind: "chart", chart }] }));

export function resetChat() {
  iris.set((s) => ({ ...s, messages: [], bubbles: [] }));
}

export async function ask(text: string) {
  const q = text.trim();
  if (!q || iris.get().busy) return;
  say(q, true);
  if (keySource() === "none") {
    say("To chat with me, add a Claude API key in Settings, under Iris.");
    return;
  }
  iris.set((s) => ({ ...s, busy: true, messages: [...s.messages, { role: "user", content: q }] }));
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const reply = await send();
      if (!reply) return;
      const { content, stop_reason } = reply;
      iris.set((s) => ({ ...s, messages: [...s.messages, { role: "assistant", content }] }));
      if (stop_reason === "refusal") {
        say("Let's stick to Eye Lab: the games, the filters, or the science behind them. What would you like to know?");
        return;
      }
      const words = content.filter((b) => b.type === "text").map((b) => String(b.text)).join("").trim();
      if (words) say(words);
      if (stop_reason !== "tool_use") return;
      const results = await Promise.all(content.filter((b) => b.type === "tool_use").map(runTool));
      iris.set((s) => ({ ...s, messages: [...s.messages, { role: "user", content: results }] }));
    }
  } finally {
    iris.set((s) => ({ ...s, busy: false }));
  }
}

async function send(): Promise<{ content: Block[]; stop_reason: string } | null> {
  let r: Response;
  try {
    r = await fetch(SERVER, {
      method: "POST",
      headers: { "content-type": "application/json", "x-anthropic-key": iris.get().apiKey },
      body: JSON.stringify({ messages: iris.get().messages, context: contextText() }),
    });
  } catch {
    fail("I couldn't reach the internet. Check your connection and try again.");
    return null;
  }
  const data = (await r.json().catch(() => null)) as { content?: Block[]; stop_reason?: string; error?: string } | null;
  if (r.ok && data?.content) return { content: data.content, stop_reason: data.stop_reason ?? "" };
  if (r.status === 401 || r.status === 403) fail("Your Claude API key wasn't accepted. Check it in Settings, under Iris.");
  else if (r.status === 413) {
    resetChat();
    fail("Our chat got really long, so I've started a fresh one. What would you like to know?");
  } else if ([429, 502, 503, 529].includes(r.status)) fail("I'm a bit busy right now. Try again in a moment.");
  else fail(`Something went wrong (${r.status}). ${data?.error ?? ""}`.trim());
  return null;
}

/** Drop the unanswered user turn so the next question starts cleanly. */
function fail(text: string) {
  iris.set((s) => {
    const messages = [...s.messages];
    while (messages.length && messages[messages.length - 1].role === "user") messages.pop();
    return { ...s, messages };
  });
  say(text);
}

// --- context ----------------------------------------------------------------------

const cutoffPosition = (lod: number) => Math.round(((7 - lod) / 6.5) * 100) / 100;

/** What Iris can see of the app right now; goes with every request. */
export function contextText(): string {
  const d = lab.get();
  const s = d.settings;
  const f = filter.get();
  const n = nav.get();
  const now = new Date();
  const screen = n.game
    ? `playing ${n.game.name} (${n.game.key})`
    : n.tab === "progress"
      ? "Home, My progress tab"
      : "Home, Games tab";
  const lod = f.params[lodKey(f.mode)];
  const filterLine =
    f.mode === 0
      ? "off"
      : `${MODE_NAMES[f.mode]} (${MODES[f.mode]}) at ${lodToCpd(lod).toFixed(1)} c/°, cutoff position ${cutoffPosition(lod)} (0 coarse, 1 fine)`;
  const played = d.sessions.filter((x) => x.date === today()).length;
  return [
    `Date: ${today()} (${now.toLocaleDateString(undefined, { weekday: "long" })}), local time ${now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.`,
    `Player: ${s.name || "unnamed"}. Screen: ${screen}. The Iris chat panel is open.`,
    `Filter: ${filterLine}. Whole screen: ${f.wholeScreen ? "on" : "off"} (helper ${helper.get().status}). High-pass sliders: contrast boost ${f.params.hp_gain.toFixed(1)}×, coarse shapes kept ${Math.round(f.params.hp_keep * 100)}%. Low-pass strength ${Math.round(f.params.lp_mix * 100)}%.`,
    `Settings: eye being tested ${s.eye}, distance ${Math.round(s.distanceCm)} cm, screen calibrated ${s.pxPerCm > 0 ? "yes" : "no"}, daily goal ${s.dailyGoalMin} min, eye tracking during games ${s.eyeTracking ? "on" : "off"}, sounds ${s.sound ? "on" : "off"}.`,
    `Today so far: ${Math.round(filterMinutesOn(d, today()))} filter minutes, ${played} ${played === 1 ? "game" : "games"} played, ${d.stars} trophies in total, ${streak(d)} day streak.`,
  ].join("\n");
}

// --- tools ------------------------------------------------------------------------

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Cutoff position 0 (coarsest) .. 1 (finest) to the blur scale the stores use. */
const positionToLod = (p: number) => 7 - 6.5 * clamp(p, 0, 1);

const SETTINGS_TABS: Record<string, SettingsTab> = {
  settings: "general",
  settings_general: "general",
  settings_filters: "filters",
  settings_history: "history",
  settings_iris: "iris",
};

async function runTool(block: Block): Promise<Block> {
  const input = (block.input ?? {}) as Record<string, unknown>;
  let out = "";
  let isError = false;
  switch (block.name) {
    case "open_game": {
      const g = gameByKey(String(input.game ?? ""));
      if (g && GAMES.includes(g)) {
        openGame(g);
        out = `Opened ${g.name}. The player now sees its how-to-play card; the chat panel closed so they can play.`;
      } else {
        out = `Unknown game '${String(input.game)}'. Keys: ${GAMES.map((x) => x.key).join(", ")}.`;
        isError = true;
      }
      break;
    }
    case "open_page": {
      const page = String(input.page ?? "home");
      if (page === "calibrate") {
        openGame(CALIBRATE);
        out = "Opened the screen calibration (match a bank card).";
      } else if (page in SETTINGS_TABS) {
        openPanel("settings", SETTINGS_TABS[page]);
        out = `Opened Settings, ${SETTINGS_TABS[page]} tab. The chat panel is replaced by Settings; the player can press Ask Iris to come back.`;
      } else if (page === "progress" || page === "profile") {
        openTab("progress");
        out = "Opened the My progress tab behind the chat panel.";
      } else {
        openTab("games");
        out = "Opened Home, Games tab, behind the chat panel.";
      }
      break;
    }
    case "set_filter": {
      const m = MODES.indexOf(String(input.mode ?? "") as (typeof MODES)[number]);
      if (m < 0) {
        out = `Unknown filter. Use one of: ${MODES.join(", ")}.`;
        isError = true;
        break;
      }
      setMode(m as Mode);
      const detail = num(input.detail);
      if (detail !== null && m !== 0) setCutoff(positionToLod(detail));
      const f = filter.get();
      out =
        m === 0
          ? "Filter off."
          : `Filter set to ${MODE_NAMES[m]} at ${lodToCpd(f.params[lodKey(m as Mode)]).toFixed(1)} c/°${f.wholeScreen ? " (whole screen)" : " (in the page)"}.`;
      break;
    }
    case "set_filter_params": {
      if (input.reset === true) resetParams();
      const gain = num(input.hp_gain);
      const keep = num(input.hp_keep);
      const mix = num(input.lp_mix);
      const hp = num(input.hp_cutoff);
      const lp = num(input.lp_cutoff);
      if (gain !== null) setParam("hp_gain", gain);
      if (keep !== null) setParam("hp_keep", keep);
      if (mix !== null) setParam("lp_mix", mix);
      if (hp !== null) setParam("hp_lod", positionToLod(hp));
      if (lp !== null) setParam("lp_lod", positionToLod(lp));
      const p = filter.get().params;
      out = `Filter sliders now: high-pass cutoff ${lodToCpd(p.hp_lod).toFixed(1)} c/°, contrast boost ${p.hp_gain.toFixed(1)}×, coarse shapes kept ${Math.round(p.hp_keep * 100)}%; low-pass cutoff ${lodToCpd(p.lp_lod).toFixed(1)} c/°, strength ${Math.round(p.lp_mix * 100)}%.`;
      break;
    }
    case "set_whole_screen": {
      const on = Boolean(input.on);
      void setWholeScreen(on);
      out = on
        ? "Turning on the whole-screen filter. It needs the Eye Lab Overlay helper for macOS; the Magic glasses section has a download link if it isn't installed."
        : "Whole-screen filter turned off.";
      break;
    }
    case "set_setting": {
      const changed: string[] = [];
      const distance = num(input.distance_cm);
      if (distance !== null) {
        setSetting("distanceCm", Math.round(clamp(distance, 20, 400)));
        changed.push(`distance ${lab.get().settings.distanceCm} cm`);
      }
      if (typeof input.eye === "string") {
        const eye = (["Both", "Left", "Right"] as Eye[]).find((e) => e.toLowerCase() === String(input.eye).toLowerCase());
        if (eye) {
          setSetting("eye", eye);
          changed.push(`eye being tested ${eye}`);
        } else {
          out = `Unknown eye '${String(input.eye)}'. Use Both, Left or Right.`;
          isError = true;
        }
      }
      const goal = num(input.daily_goal_min);
      if (goal !== null) {
        setSetting("dailyGoalMin", Math.round(clamp(goal, 15, 480)));
        changed.push(`daily goal ${lab.get().settings.dailyGoalMin} min`);
      }
      if (typeof input.eye_tracking === "boolean") {
        setSetting("eyeTracking", input.eye_tracking);
        changed.push(`eye tracking during games ${input.eye_tracking ? "on" : "off"}`);
      }
      if (typeof input.sound === "boolean") {
        setSetting("sound", input.sound);
        changed.push(`sounds ${input.sound ? "on" : "off"}`);
      }
      if (!isError) out = changed.length ? `Changed: ${changed.join(", ")}.` : "Nothing to change.";
      break;
    }
    case "get_progress": {
      const key = typeof input.game === "string" && gameByKey(input.game) ? input.game : null;
      out = JSON.stringify(progressReport(lab.get(), key));
      break;
    }
    case "show_chart": {
      const c = chartData(lab.get(), {
        kind: String(input.kind ?? "") as ChartKind,
        game: typeof input.game === "string" ? input.game : null,
        days: num(input.days),
      });
      if ("error" in c) {
        out = c.error;
        isError = true;
      } else {
        show(c);
        out = describeChart(c);
      }
      break;
    }
    case "export_data": {
      const what = String(input.what ?? "results") as ExportKind;
      if (!["results", "sessions", "filter_time"].includes(what)) {
        out = "Unknown export. Use results, sessions or filter_time.";
        isError = true;
        break;
      }
      const d = lab.get();
      const name = (d.settings.name || "player").replace(/[^\w-]+/g, "_");
      downloadCsv(exportCsv(d, what), `eyelab-${name}-${what}-${today()}.csv`);
      out = `Downloading eyelab-${name}-${what}-${today()}.csv to the player's downloads folder.`;
      break;
    }
    default:
      out = "Unknown tool.";
      isError = true;
  }
  return { type: "tool_result", tool_use_id: block.id, content: out, ...(isError ? { is_error: true } : {}) };
}
