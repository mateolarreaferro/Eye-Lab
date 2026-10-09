import { createStore } from "./store";
import { ANATOMICAL, median, oscillation, resample } from "./eyeMetrics";
import { EyeTracker, type EyeSample } from "./eyeTracker";
import type { EyeSummary } from "./lab";

/*
  Eye tracking during an ordinary game (the "Eye tracking" switch). The shell
  starts this on the how-to-play card so the camera is ready, records while the
  game runs, and on finishing reports an EyeSummary for the session plus a CSV
  the result card can save. Games don't show targets at known places, so there
  is no calibration: degrees use the anatomical scale, which is fine for the
  frequency of a back-and-forth movement and rough for its size.

  Games that use the camera themselves (Eye movement, Magic glasses) skip it.
*/

export const OWNS_CAMERA = new Set(["eye_movement", "patch_room", "calibrate"]);
const GRID_HZ = 30;

interface Live {
  status: "off" | "starting" | "running" | "failed";
  message: string;
  /** Both eyes open and found in the latest frame. */
  seeing: boolean;
}

export const sessionEyes = createStore<Live>({ status: "off", message: "", seeing: false });
export const useSessionEyes = sessionEyes.use;

let tracker: EyeTracker | null = null;
let recording = false;
let samples: EyeSample[] = [];

export function startSessionEyes() {
  if (tracker) return;
  const t = new EyeTracker();
  tracker = t;
  samples = [];
  recording = false;
  sessionEyes.set({ status: "starting", message: "Starting the camera…", seeing: false });
  t.onSample = (s) => {
    if (recording) samples.push(s);
    const seeing = s.ok;
    if (seeing !== sessionEyes.get().seeing) sessionEyes.set((l) => ({ ...l, seeing }));
  };
  void t.start().then(() => {
    if (tracker !== t) return;
    sessionEyes.set({ status: t.status === "running" ? "running" : "failed", message: t.message, seeing: false });
  });
}

export const sessionVideo = () => tracker?.video ?? null;
export const sessionLandmarks = () => tracker?.landmarks ?? null;

export function recordSessionEyes(on: boolean) {
  recording = on;
}

export function stopSessionEyes() {
  tracker?.stop();
  tracker = null;
  recording = false;
  sessionEyes.set({ status: "off", message: "", seeing: false });
}

/** Stops recording and sums up what was seen; null if too little was recorded. */
export function finishSessionEyes(): { summary: EyeSummary; csv: string } | null {
  recording = false;
  const all = samples;
  samples = [];
  if (all.length < GRID_HZ * 3) return null;
  const seconds = all[all.length - 1].t - all[0].t;
  const ok = all.filter((s) => s.ok);
  // Each eye centred on its own median, then the two averaged, in anatomical degrees.
  const cr = median(ok.map((s) => s.rx));
  const cl = median(ok.map((s) => s.lx));
  const deg = (s: EyeSample) => (ANATOMICAL.x.b * (s.rx - cr) + ANATOMICAL.x.b * (s.lx - cl)) / 2;
  let oscHz: number | null = null;
  let oscPpDeg: number | null = null;
  if (ok.length > GRID_HZ * 4) {
    const r = resample(ok.map((s) => s.t), ok.map(deg), GRID_HZ);
    const o = oscillation(r.x, GRID_HZ);
    if (o.found) {
      oscHz = Math.round(o.hz * 10) / 10;
      oscPpDeg = Math.round(o.ppDeg * 10) / 10;
    }
  }
  const f4 = (n: number) => (Number.isFinite(n) ? n.toFixed(4) : "");
  const t0 = all[0].t;
  const rows = ["t_s,eyes_ok,right_x_raw,right_y_raw,left_x_raw,left_y_raw,gaze_x_deg_estimate,eye_width_px"];
  for (const s of all) {
    rows.push([f4(s.t - t0), s.ok ? 1 : 0, f4(s.rx), f4(s.ry), f4(s.lx), f4(s.ly), s.ok ? f4(deg(s)) : "", s.eyePx.toFixed(1)].join(","));
  }
  return {
    summary: {
      tracked: Math.round((ok.length / all.length) * 100) / 100,
      fps: Math.round(all.length / Math.max(seconds, 1e-3)),
      seconds: Math.round(seconds),
      oscHz,
      oscPpDeg,
    },
    csv: rows.join("\n") + "\n",
  };
}

/** Hands a CSV to the browser as a download. */
export function downloadCsv(csv: string, name: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileStamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};
