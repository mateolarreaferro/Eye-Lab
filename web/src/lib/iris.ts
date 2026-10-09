import { createStore, loadJSON, saveJSON } from "./store";
import { GAMES, gameByKey } from "../app/catalog";
import { goHome, openGame, openPanel } from "./nav";
import { MODES, filter, setCutoff, setMode, type Mode } from "./filter";
import { setWholeScreen } from "./helper";
import { progressSummary } from "./lab";

/*
  Iris, the Eye Lab guide, powered by Claude. The page sends the conversation
  to the Eye Lab server (iris-server/ in the Eye-Lab repo), which holds Iris's
  system prompt and tool definitions; the tools run here. The player's own
  Claude API key (Settings > Iris) goes with each request as x-anthropic-key and
  is used by the server for that request only. It is kept in this browser's
  localStorage, apart from the progress data, so get_progress never sees it.
*/

const SERVER = import.meta.env.VITE_IRIS_API ?? "https://eye-lab-iris.vercel.app/api/iris";
const KEY_STORE = "eyelab:iris-key";
const MAX_TOOL_ROUNDS = 6;

type Block = { type: string; [k: string]: unknown };
export interface Message {
  role: "user" | "assistant";
  content: string | Block[];
}

/** What the chat shows: text bubbles only. */
export interface Bubble {
  mine: boolean;
  text: string;
}

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

const say = (text: string, mine = false) => iris.set((s) => ({ ...s, bubbles: [...s.bubbles, { mine, text }] }));

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
      body: JSON.stringify({ messages: iris.get().messages }),
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

async function runTool(block: Block): Promise<Block> {
  const input = (block.input ?? {}) as Record<string, unknown>;
  let out = "";
  let isError = false;
  switch (block.name) {
    case "open_game": {
      const g = gameByKey(String(input.game ?? ""));
      if (g && GAMES.includes(g)) {
        openGame(g);
        out = `Opened ${g.name}. The player now sees its how-to-play card.`;
      } else {
        out = `Unknown game '${String(input.game)}'.`;
        isError = true;
      }
      break;
    }
    case "open_page": {
      const page = String(input.page ?? "home");
      if (page === "profile") openPanel("progress");
      else if (page === "settings") openPanel("settings", "general");
      else goHome();
      out = `Opened the ${page} page.`;
      break;
    }
    case "set_filter": {
      const m = MODES.indexOf(String(input.mode ?? "") as (typeof MODES)[number]);
      if (m < 0) {
        out = "Unknown filter.";
        isError = true;
        break;
      }
      setMode(m as Mode);
      if (typeof input.detail === "number") setCutoff(7 - 6.5 * Math.min(1, Math.max(0, input.detail)));
      out = `Filter set to ${MODES[m]}${filter.get().wholeScreen ? " (whole screen)" : " (in the page)"}.`;
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
    case "get_progress":
      out = JSON.stringify(progressSummary());
      break;
    default:
      out = "Unknown tool.";
      isError = true;
  }
  return { type: "tool_result", tool_use_id: block.id, content: out, ...(isError ? { is_error: true } : {}) };
}
