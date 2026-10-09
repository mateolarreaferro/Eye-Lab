import { Check, DownloadSimple, Play } from "@phosphor-icons/react";
import { Exercise } from "../exercise/Exercise";
import { circle, polygon, ring, starPoints } from "../exercise/draw";
import { ANATOMICAL, calibrateAxis, type Hold, type Linear, median, oscillation, pursuit, resample, stability } from "../lib/eyeMetrics";
import { EYE_POINTS, EyeTracker, IRIS_POINTS, type EyeSample } from "../lib/eyeTracker";
import { filter, setMode, type Mode } from "../lib/filter";
import { lab } from "../lib/lab";
import { downloadCsv, fileStamp } from "../lib/sessionEyes";
import { play } from "../lib/sfx";

/*
  Eye movement: webcam eye tracking for steadiness (nystagmus) and following
  (smooth pursuit). No answers needed, so it suits young children: they only
  watch a star. New in the web app; there is no Godot original.

  1. Check: a mirrored camera view with the tracked eye points, until the eyes
     are found and big enough.
  2. Calibration: the star holds still at five places; the median reading at each
     maps camera units to degrees (medians tolerate nystagmus and blinks).
  3. Holding still: the star stays in the centre for FIX_S seconds.
  4. Following: the star swings left and right for PURSUIT_S seconds.
  5. Review: the traces, a CSV download, then the result card.

  The analysis is in lib/eyeMetrics.ts, the tracking in lib/eyeTracker.ts.
  The vision filter is switched off for the test and restored afterwards.
*/

type Phase = "check" | "calib" | "fixation" | "pursuit" | "review";

const HOLD_S = 1.8;
/** Readings from the start of each hold are skipped while the eyes jump to the star. */
const SETTLE_S = 0.7;
const FIX_S = 12;
const PURSUIT_S = 12;
const PURSUIT_HZ = 0.25;
const MIN_EYE_PX = 20;
/** Below this eye-to-star correlation, gain and lag mean nothing. */
const PURSUIT_MIN_R = 0.5;
const GRID_HZ = 30;

const INK = "#161c32";
const SKY = "#55c1f2";
const MUTED = "#a3a9b8";
const HAIRLINE = "#e3e8ef";

interface Frame {
  phase: Phase;
  hold: number;
  tx: number;
  ty: number;
  s: EyeSample;
}

interface EyeMap {
  x: Linear;
  y: Linear;
  calibrated: boolean;
}

export default class EyeMovement extends Exercise {
  tracker = new EyeTracker();
  phase: Phase = "check";
  phaseStart = 0;
  goodSince = -1;
  lastHold = 0;
  lostSince = -1;
  statusAt = 0;
  frames: Frame[] = [];
  holds: [number, number][] = [];
  pursuitAmp = 10;
  prevFilter: Mode = 0;
  /** Filled after the test. */
  maps: { right: EyeMap; left: EyeMap } | null = null;
  gaze: { t: number; x: number; y: number; phase: Phase; tx: number; ty: number }[] = [];
  report: ReturnType<EyeMovement["analyse"]> | null = null;

  setup() {
    const s = lab.get().settings;
    this.id = "eye_movement";
    this.title = "Eye movement";
    this.steps = [
      `Sit about ${Math.round(s.distanceCm)} cm from the screen, face in good light, camera at eye level.`,
      "Allow the camera. Wait until the eyes are found, then press Begin.",
      "Watch the star with your eyes and keep your head still. It takes about 35 seconds.",
      "At the end you see the eye traces and can save them for the lab.",
    ];
    this.instructions =
      "The video stays on this device; only the eye positions are kept. Webcam tracking is approximate, and this is a measurement, not a diagnosis.";
  }

  begin() {
    this.prevFilter = filter.get().mode;
    setMode(0);
    this.tracker.onSample = (s) => this.onSample(s);
    void this.tracker.start().then(() => this.changed());
    this.setAnswers([{ id: "begin", text: "Begin", icon: Play, tip: "Shortcut: Enter" }], { w: 140, h: 64 });
    this.setAnswersEnabled(false);
  }

  dispose() {
    super.dispose();
    this.tracker.stop();
    if (this.started) setMode(this.prevFilter);
  }

  // --- flow ---------------------------------------------------------------------------

  onAnswer(a: string | number) {
    if (a === "begin" && this.phase === "check" && this.answersEnabled) this.startTest();
    else if (a === "save") this.saveCsv();
    else if (a === "done") this.end();
  }

  onKey(e: KeyboardEvent) {
    if (e.repeat || (e.key !== "Enter" && e.key !== " ")) return false;
    this.onAnswer(this.phase === "check" ? "begin" : this.phase === "review" ? "done" : "");
    return true;
  }

  startTest() {
    const ppd = this.ppd();
    const ax = Math.min(8, (this.width / 2 - 60) / ppd);
    const ay = Math.min(6, (this.height / 2 - 90) / ppd);
    this.holds = [[0, 0], [-ax, 0], [ax, 0], [0, -ay], [0, ay]];
    this.pursuitAmp = Math.min(10, (this.width / 2 - 60) / ppd);
    this.setAnswers([]);
    this.go("calib");
  }

  go(p: Phase) {
    this.phase = p;
    this.phaseStart = performance.now() / 1000;
    if (p !== "check") play("click");
  }

  tick() {
    const now = performance.now() / 1000;
    const el = now - this.phaseStart;
    const s = this.tracker.latest;
    const good = this.tracker.status === "running" && !!s?.ok && s.eyePx >= MIN_EYE_PX;

    if (this.phase === "check") {
      if (good) {
        if (this.goodSince < 0) this.goodSince = now;
      } else this.goodSince = -1;
      const ready = this.goodSince >= 0 && now - this.goodSince > 1;
      if (ready !== this.answersEnabled) this.setAnswersEnabled(ready);
    } else if (this.phase === "calib") {
      const hold = Math.floor(el / HOLD_S);
      if (hold >= this.holds.length) {
        this.feedback(true);
        this.go("fixation");
      } else if (hold !== this.lastHold) {
        this.lastHold = hold;
        play("click");
      }
    } else if (this.phase === "fixation" && el >= FIX_S) {
      this.feedback(true);
      this.go("pursuit");
    } else if (this.phase === "pursuit" && el >= PURSUIT_S) {
      this.feedback(true);
      this.finishTest();
    }

    if (this.phase !== "review" && now - this.statusAt > 0.5) {
      this.statusAt = now;
      this.lostSince = good ? -1 : this.lostSince < 0 ? now : this.lostSince;
      this.setStatus(this.statusText(now));
    }
  }

  statusText(now: number) {
    const t = this.tracker;
    if (t.status !== "running") return t.message;
    const lost = this.lostSince >= 0 && now - this.lostSince > 0.4;
    const fps = `${Math.round(t.fps)} frames a second`;
    if (this.phase === "check") return `Camera: ${fps}`;
    return lost ? "Can't see the eyes. Look at the star, head still." : `Tracking the eyes, ${fps}`;
  }

  /** Where the star is (degrees from the centre) at time t, in the current phase. */
  targetAt(t: number): [number, number, number] {
    const el = t - this.phaseStart;
    if (this.phase === "calib") {
      const hold = Math.min(this.holds.length - 1, Math.max(0, Math.floor(el / HOLD_S)));
      return [...this.holds[hold], hold];
    }
    if (this.phase === "pursuit") return [this.pursuitAmp * Math.sin(2 * Math.PI * PURSUIT_HZ * Math.max(0, el)), 0, -1];
    return [0, 0, -1];
  }

  onSample(s: EyeSample) {
    if (this.phase === "check" || this.phase === "review") return;
    const [tx, ty, hold] = this.targetAt(s.t);
    // Calibration keeps only the settled part of each hold.
    const settled = this.phase !== "calib" || s.t - this.phaseStart - hold * HOLD_S >= SETTLE_S;
    this.frames.push({ phase: this.phase, hold: settled ? hold : -1, tx, ty, s });
  }

  finishTest() {
    this.tracker.stop();
    this.report = this.analyse();
    this.phase = "review";
    this.setStatus("");
    this.setAnswers(
      [
        { id: "save", text: "Save data", icon: DownloadSimple, tip: "A CSV file of every camera frame" },
        { id: "done", text: "Done", icon: Check, tip: "Shortcut: Enter" },
      ],
      { w: 140, h: 64 },
    );
  }

  // --- analysis -----------------------------------------------------------------------

  analyse() {
    const calib = this.frames.filter((f) => f.phase === "calib" && f.hold >= 0 && f.s.ok);
    const mapEye = (kx: "rx" | "lx", ky: "ry" | "ly"): EyeMap => {
      const holds = (k: "rx" | "lx" | "ry" | "ly", axis: 0 | 1): Hold[] =>
        this.holds.map((h, i) => ({ target: h[axis], raw: calib.filter((f) => f.hold === i).map((f) => f.s[k]) }));
      const cx = calibrateAxis(holds(kx, 0));
      const cy = calibrateAxis(holds(ky, 1));
      // Fallback: the anatomical scale, centred on the centre hold.
      const centre = (k: "rx" | "lx" | "ry" | "ly") => median(calib.filter((f) => f.hold === 0).map((f) => f.s[k])) || 0;
      const anat = (l: Linear, c: number): Linear => ({ a: -l.b * c, b: l.b });
      return { x: cx ?? anat(ANATOMICAL.x, centre(kx)), y: cy ?? anat(ANATOMICAL.y, centre(ky)), calibrated: !!cx };
    };
    const maps = { right: mapEye("rx", "ry"), left: mapEye("lx", "ly") };
    this.maps = maps;
    const deg = (m: Linear, raw: number) => m.a + m.b * raw;

    this.gaze = this.frames
      .filter((f) => f.s.ok)
      .map((f) => ({
        t: f.s.t,
        x: (deg(maps.right.x, f.s.rx) + deg(maps.left.x, f.s.lx)) / 2,
        y: (deg(maps.right.y, f.s.ry) + deg(maps.left.y, f.s.ly)) / 2,
        phase: f.phase,
        tx: f.tx,
        ty: f.ty,
      }));

    const part = (p: Phase) => this.gaze.filter((g) => g.phase === p);
    const coverage = (p: Phase) => {
      const all = this.frames.filter((f) => f.phase === p).length;
      return all ? part(p).length / all : 0;
    };
    const span = (p: Phase) => {
      const fr = this.frames.filter((f) => f.phase === p);
      return fr.length > 1 ? fr[fr.length - 1].s.t - fr[0].s.t : 0;
    };

    const fix = part("fixation");
    const fixOk = fix.length > GRID_HZ * 4 && coverage("fixation") > 0.5;
    const fixGrid = fixOk ? resample(fix.map((g) => g.t), fix.map((g) => g.x), GRID_HZ) : null;
    const stab = fixOk ? stability(fix.map((g) => g.x), fix.map((g) => g.y)) : null;
    const osc = fixGrid ? oscillation(fixGrid.x, GRID_HZ) : null;

    // The first second of pursuit is the eyes catching up; it is left out.
    const purAll = part("pursuit");
    const pur = purAll.filter((g) => g.t - purAll[0].t > 1);
    const purOk = pur.length > GRID_HZ * 4 && coverage("pursuit") > 0.5;
    let purRes = null;
    if (purOk) {
      const t0 = pur[0].t;
      const t1 = pur[pur.length - 1].t;
      const e = resample(pur.map((g) => g.t), pur.map((g) => g.x), GRID_HZ, t0, t1);
      const tg = resample(pur.map((g) => g.t), pur.map((g) => g.tx), GRID_HZ, t0, t1);
      purRes = pursuit(e.x, tg.x, GRID_HZ);
    }

    const frames = this.frames.length;
    const all = frames ? this.frames.filter((f) => f.s.ok).length / frames : 0;
    const total = span("calib") + span("fixation") + span("pursuit");
    return {
      tracked: all,
      fps: total > 0 ? frames / total : 0,
      eyePx: median(this.frames.filter((f) => f.s.ok).map((f) => f.s.eyePx)),
      calibrated: maps.right.calibrated && maps.left.calibrated,
      stab,
      osc,
      pursuit: purRes,
    };
  }

  // --- output ---------------------------------------------------------------------------

  saveCsv() {
    const m = this.maps;
    if (!m) return;
    const t0 = this.frames[0]?.s.t ?? 0;
    const f4 = (n: number) => (Number.isFinite(n) ? n.toFixed(4) : "");
    const rows = ["t_s,phase,target_x_deg,target_y_deg,eyes_ok,right_x_raw,right_y_raw,left_x_raw,left_y_raw,gaze_x_deg,gaze_y_deg,eye_width_px"];
    for (const f of this.frames) {
      const gx = (m.right.x.a + m.right.x.b * f.s.rx + m.left.x.a + m.left.x.b * f.s.lx) / 2;
      const gy = (m.right.y.a + m.right.y.b * f.s.ry + m.left.y.a + m.left.y.b * f.s.ly) / 2;
      rows.push(
        [f4(f.s.t - t0), f.phase, f4(f.tx), f4(f.ty), f.s.ok ? 1 : 0, f4(f.s.rx), f4(f.s.ry), f4(f.s.lx), f4(f.s.ly), f4(gx), f4(gy), f.s.eyePx.toFixed(1)].join(","),
      );
    }
    downloadCsv(rows.join("\n") + "\n", `eyelab-eye-movement-${fileStamp()}.csv`);
    play("success");
  }

  summary() {
    const r = this.report;
    if (!r) return null;
    const lines: string[] = [];
    lines.push(`Eyes tracked in ${Math.round(r.tracked * 100)}% of camera frames, ${Math.round(r.fps)} frames a second.`);
    if (r.stab && r.osc) {
      lines.push(`Holding still: the gaze wandered ${r.stab.sdX.toFixed(1)}° side to side and ${r.stab.sdY.toFixed(1)}° up and down (standard deviation).`);
      lines.push(
        r.osc.found
          ? `A regular back-and-forth movement: about ${r.osc.hz.toFixed(1)} times a second, ${r.osc.ppDeg.toFixed(1)}° from side to side.`
          : "No regular back-and-forth movement stood out above the tracking noise.",
      );
    } else lines.push("Holding still: the eyes were not seen often enough to measure.");
    if (r.pursuit && r.pursuit.r < PURSUIT_MIN_R) {
      lines.push("Following: the eyes did not follow the star this time.");
    } else if (r.pursuit) {
      lines.push(
        `Following: the eyes moved ${Math.round(r.pursuit.gain * 100)}% as far as the star, about ${Math.round(r.pursuit.lagMs)} ms behind it.`,
      );
    } else lines.push("Following: the eyes were not seen often enough to measure.");
    if (!r.calibrated) lines.push("\nCalibration didn't work for at least one eye, so degrees there are an estimate from average eye size.");
    if (r.eyePx < 30) lines.push("The eyes looked small on camera; sitting closer gives steadier tracking.");
    lines.push("\nWebcam tracking is accurate to roughly 1 to 2 degrees. This is a measurement to repeat over the weeks, not a diagnosis.");
    const g = this.gaze;
    const keep = (p: Phase) => g.filter((x, i) => x.phase === p && i % 2 === 0);
    const trace = [...keep("fixation"), ...keep("pursuit")];
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      value: r.stab ? r.stab.sdX : undefined,
      unit: "° wander",
      text: lines.join("\n"),
      detail: {
        tracked: round(r.tracked),
        fps: Math.round(r.fps),
        eye_px: Math.round(r.eyePx),
        calibrated: r.calibrated,
        distance_cm: lab.get().settings.distanceCm,
        fix_sd_x: r.stab && round(r.stab.sdX),
        fix_sd_y: r.stab && round(r.stab.sdY),
        bcea: r.stab && round(r.stab.bcea),
        osc_found: r.osc?.found ?? null,
        osc_hz: r.osc && round(r.osc.hz),
        osc_pp_deg: r.osc && round(r.osc.ppDeg),
        pursuit_gain: r.pursuit && round(r.pursuit.gain),
        pursuit_lag_ms: r.pursuit && Math.round(r.pursuit.lagMs),
        pursuit_r: r.pursuit && round(r.pursuit.r),
        // About 15 points a second: time, phase, gaze and star x/y in degrees.
        trace: trace.map((x) => [round(x.t - (trace[0]?.t ?? 0)), x.phase === "fixation" ? "f" : "p", round(x.x), round(x.y), round(x.tx)]),
      },
    };
  }

  // --- drawing ------------------------------------------------------------------------

  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = "#ffffff"; // a bright screen also lights the face
    g.fillRect(0, 0, this.width, this.height);
    if (!this.started) return;
    if (this.phase === "check") this.drawCheck(g);
    else if (this.phase === "review") this.drawReview(g);
    else {
      const [x, y] = this.targetAt(performance.now() / 1000);
      this.drawStar(g, this.width / 2 + x * this.ppd(), this.height / 2 + y * this.ppd());
    }
  }

  /** The star: a pulsing halo and a slowly turning star around a fixed centre dot. */
  drawStar(g: CanvasRenderingContext2D, x: number, y: number) {
    const r = Math.min(34, Math.max(16, this.ppd() * 0.6));
    const t = performance.now() / 1000;
    g.save();
    g.globalAlpha = 0.25;
    circle(g, x, y, r * (1.5 + 0.2 * Math.sin(t * 4)), SKY);
    g.restore();
    circle(g, x, y, r, "#ffffff");
    ring(g, x, y, r, INK, 2);
    polygon(g, starPoints(x, y, r * 0.8, r * 0.36, 5, t * 0.8), SKY);
    circle(g, x, y, Math.max(2.5, r * 0.12), INK);
  }

  drawCheck(g: CanvasRenderingContext2D) {
    const v = this.tracker.video;
    const w = Math.min(560, this.width - 48);
    const h = v && v.videoWidth ? (w * v.videoHeight) / v.videoWidth : (w * 9) / 16;
    const x0 = (this.width - w) / 2;
    const y0 = Math.max(80, (this.height - h) / 2 - 60);
    g.save();
    g.beginPath();
    g.roundRect(x0, y0, w, h, 16);
    g.clip();
    g.fillStyle = "#eef3f7";
    g.fillRect(x0, y0, w, h);
    if (v && v.readyState >= 2) {
      // Mirrored, like a selfie view.
      g.translate(x0 + w, y0);
      g.scale(-1, 1);
      g.drawImage(v, 0, 0, w, h);
      const lm = this.tracker.landmarks;
      if (lm) {
        for (const i of EYE_POINTS) circle(g, lm[i].x * w, lm[i].y * h, 3, SKY);
        for (const i of IRIS_POINTS) {
          circle(g, lm[i].x * w, lm[i].y * h, 4, "#ffffff");
          circle(g, lm[i].x * w, lm[i].y * h, 2.5, INK);
        }
      }
    }
    g.restore();
    g.strokeStyle = HAIRLINE;
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(x0, y0, w, h, 16);
    g.stroke();
    this.drawPrompt(g, this.checkText(), y0 + h + 36, INK, 20);
  }

  checkText() {
    const t = this.tracker;
    if (t.status === "starting") return "Starting the camera and the eye tracker…";
    if (t.status !== "running") return t.message;
    const s = t.latest;
    if (!s || !this.tracker.landmarks) return "Can't see a face. Sit facing the camera with light on the face.";
    if (s.eyePx < MIN_EYE_PX) return "Move a little closer to the camera.";
    if (!s.ok) return "Eyes closed? Open them wide and look at the screen.";
    return "Eyes found. Keep the head still and press Begin.";
  }

  drawReview(g: CanvasRenderingContext2D) {
    const left = 64;
    const right = this.width - 32;
    const top = 116;
    const bottom = this.height - 150;
    const gap = 56;
    const ph = (bottom - top - gap) / 2;
    const fix = this.gaze.filter((p) => p.phase === "fixation");
    const pur = this.gaze.filter((p) => p.phase === "pursuit");
    this.plot(g, "Holding still", left, top, right - left, ph, FIX_S, [
      { pts: fix.map((p) => [p.t, p.y]), color: MUTED },
      { pts: fix.map((p) => [p.t, p.x]), color: SKY },
    ], 5);
    this.plot(g, "Following the star", left, top + ph + gap, right - left, ph, PURSUIT_S, [
      { pts: pur.map((p) => [p.t, p.tx]), color: INK, dash: true },
      { pts: pur.map((p) => [p.t, p.x]), color: SKY },
    ], Math.ceil(this.pursuitAmp + 3));
  }

  /** A time plot of degrees, zero line in the middle, ±range on the y axis. */
  plot(
    g: CanvasRenderingContext2D,
    title: string,
    x: number,
    y: number,
    w: number,
    h: number,
    seconds: number,
    series: { pts: [number, number][]; color: string; dash?: boolean }[],
    range: number,
  ) {
    const font = (wt: number, px: number) => `${wt} ${px}px "Figtree Variable", system-ui, sans-serif`;
    g.fillStyle = INK;
    g.font = font(600, 17);
    g.textAlign = "left";
    g.textBaseline = "bottom";
    g.fillText(title, x, y - 8);
    g.fillStyle = MUTED;
    g.font = font(400, 13);
    g.textAlign = "right";
    g.fillText(series.length > 1 && series[0].dash ? "dashed: the star · blue: the eyes" : "blue: side to side · grey: up and down", x + w, y - 8);
    g.strokeStyle = HAIRLINE;
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, w, h);
    g.textBaseline = "middle";
    const yOf = (d: number) => y + h / 2 - (Math.max(-range, Math.min(range, d)) / range) * (h / 2);
    for (const d of [range, 0, -range]) {
      g.beginPath();
      g.moveTo(x, yOf(d));
      g.lineTo(x + w, yOf(d));
      g.stroke();
      g.fillText(`${d > 0 ? "+" : ""}${d}°`, x - 8, yOf(d));
    }
    const t0 = series.find((s) => s.pts.length)?.pts[0][0] ?? 0;
    for (const s of series) {
      g.strokeStyle = s.color;
      g.lineWidth = s.dash ? 1.5 : 2;
      g.setLineDash(s.dash ? [6, 5] : []);
      g.beginPath();
      let prev = -1;
      for (const [t, d] of s.pts) {
        const px = x + ((t - t0) / seconds) * w;
        // Break the line across gaps in tracking.
        if (prev < 0 || t - prev > 0.15) g.moveTo(px, yOf(d));
        else g.lineTo(px, yOf(d));
        prev = t;
      }
      g.stroke();
    }
    g.setLineDash([]);
  }
}
