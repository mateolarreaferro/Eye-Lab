import { createStore } from "./store";
import { filter, lodKey, setMode, type Mode } from "./filter";
import { lab } from "./lab";

/*
  Whole screen: the macOS helper (Eye Lab Overlay.app, overlay/ in the Eye-Lab
  repo) filters the entire screen, other apps included, which no web page can
  do. The page and the helper talk two ways:

  - A small HTTP server in the helper on 127.0.0.1:47823. GET /status says it
    is running, whether macOS has granted Screen Recording, its current state
    and the filter seconds it has logged per day; POST /state sends
    {mode, lod, gain, keep, mix} (mode 0 turns it off and quits). The helper
    only answers this site's origins and localhost.
  - The eyelab-overlay:// link, which macOS routes to the installed helper.
    Used only to launch it when it isn't running; the browser asks once whether
    to open the app.

  Browsers treat 127.0.0.1 as a trustworthy origin, so an https page may call
  it (Chrome adds a private-network preflight, which the helper answers, and
  newer Chrome asks the visitor once to allow local network access). So the
  page never contacts the helper until someone turns Whole screen on; after
  that it remembers and checks on later visits.
*/

const USED_KEY = "eyelab:helper-used";
const usedBefore = () => {
  try {
    return localStorage.getItem(USED_KEY) === "1";
  } catch {
    return false;
  }
};
const markUsed = () => {
  try {
    localStorage.setItem(USED_KEY, "1");
  } catch {
    /* ignore */
  }
};

const BASE = "http://127.0.0.1:47823";
export const DOWNLOAD_URL = "https://github.com/mateolarreaferro/Eye-Lab/releases/latest/download/Eye.Lab.Overlay.zip";

export type HelperStatus = "unknown" | "absent" | "launching" | "running" | "no-permission";

interface HelperState {
  status: HelperStatus;
  error: string;
}

export const helper = createStore<HelperState>({ status: "unknown", error: "" });
export const useHelper = helper.use;

interface StatusReply {
  running: boolean;
  permission: boolean;
  state?: { mode: number; lod: number };
  seconds?: Record<string, number>;
}

async function getStatus(): Promise<StatusReply | null> {
  try {
    const r = await fetch(`${BASE}/status`, { cache: "no-store", signal: AbortSignal.timeout(1500) });
    return r.ok ? ((await r.json()) as StatusReply) : null;
  } catch {
    return null;
  }
}

function payload(modeOverride?: number) {
  const { mode, params } = filter.get();
  const m = modeOverride ?? mode;
  return {
    mode: m,
    lod: params[lodKey((m === 2 ? 2 : 1) as Mode)],
    gain: params.hp_gain,
    keep: params.hp_keep,
    mix: params.lp_mix,
  };
}

async function postState(modeOverride?: number): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/state`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload(modeOverride)),
      signal: AbortSignal.timeout(1500),
    });
    return r.ok;
  } catch {
    return false;
  }
}

function launchViaLink() {
  const q = new URLSearchParams(Object.entries(payload()).map(([k, v]) => [k, String(v)]));
  // A hidden iframe keeps the page in place if the scheme is unknown.
  const f = document.createElement("iframe");
  f.style.display = "none";
  f.src = `eyelab-overlay://on?${q}`;
  document.body.appendChild(f);
  window.setTimeout(() => f.remove(), 3000);
}

function mergeSeconds(seconds?: Record<string, number>) {
  if (seconds) lab.set((d) => ({ ...d, helperSeconds: { ...d.helperSeconds, ...seconds } }));
}

function applyStatus(s: StatusReply | null) {
  if (!s) {
    const was = helper.get().status;
    helper.set({ status: was === "launching" ? "launching" : "absent", error: "" });
    if (filter.get().wholeScreen && was !== "launching") filter.set((f) => ({ ...f, wholeScreen: false }));
    return;
  }
  mergeSeconds(s.seconds);
  if (!s.permission) {
    helper.set({ status: "no-permission", error: "" });
    return;
  }
  helper.set({ status: "running", error: "" });
  const m = s.state?.mode ?? 0;
  if (m === 0) {
    if (filter.get().wholeScreen) filter.set((f) => ({ ...f, wholeScreen: false }));
  } else {
    // The helper's menu bar can change the mode; follow it.
    if (!filter.get().wholeScreen || filter.get().mode !== m) {
      filter.set((f) => ({ ...f, wholeScreen: true, mode: Math.min(2, m) as Mode }));
    }
  }
}

/** Turn the whole-screen filter on or off. */
export async function setWholeScreen(on: boolean) {
  if (!on) {
    filter.set((f) => ({ ...f, wholeScreen: false }));
    await postState(0);
    return;
  }
  markUsed();
  if (filter.get().mode === 0) setMode(1);
  filter.set((f) => ({ ...f, wholeScreen: true }));
  if (await postState()) {
    applyStatus(await getStatus());
    return;
  }
  helper.set({ status: "launching", error: "" });
  launchViaLink();
  for (let i = 0; i < 16; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await postState()) {
      applyStatus(await getStatus());
      return;
    }
  }
  filter.set((f) => ({ ...f, wholeScreen: false }));
  helper.set({ status: "absent", error: "The helper didn't answer. Install it, or open it once from Applications." });
}

// Keep the helper in step with the page: any change to mode or sliders is sent
// while Whole screen is on (throttled to one request in flight).
let sending = false;
let pending = false;
filter.subscribe(() => {
  if (!filter.get().wholeScreen || helper.get().status !== "running") return;
  if (sending) {
    pending = true;
    return;
  }
  sending = true;
  const go = async () => {
    do {
      pending = false;
      await postState();
    } while (pending);
    sending = false;
  };
  void go();
});

/** Every few seconds while the helper is in use: picks up menu-bar changes,
 * permission and filter time. Visitors who never used Whole screen, and an
 * absent helper, are never polled. */
export function startHelperPolling() {
  const tick = async () => {
    const s = helper.get().status;
    if ((s === "unknown" && usedBefore()) || s === "running" || s === "no-permission" || filter.get().wholeScreen) {
      applyStatus(await getStatus());
    }
  };
  void tick();
  const id = window.setInterval(tick, 4000);
  return () => window.clearInterval(id);
}
