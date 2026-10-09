import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";

/*
  Webcam eye tracking with MediaPipe Face Landmarker, entirely in the browser:
  camera frames never leave the device. Only the runtime and the model are
  downloaded (jsDelivr and Google storage), once, then cached by the browser.

  For each camera frame it reports where each iris sits inside its eye opening,
  in eye widths along the line between the eye corners (x, image right) and
  across it (y, image down). Dividing by the eye's own width makes the reading
  independent of how far the child sits. These are raw camera units; the Eye
  movement test turns them into degrees with its calibration holds.
*/

// Keep in step with @mediapipe/tasks-vision in package.json.
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/** Landmark indices: the eye corner on the camera image's left, the one on its right, the iris centre. */
const EYES = {
  right: { a: 33, b: 133, iris: 468 }, // the child's right eye
  left: { a: 362, b: 263, iris: 473 },
};
const BLINK = 0.45;

export interface EyeSample {
  /** Seconds (performance.now clock). */
  t: number;
  /** Face found and neither eye closed. */
  ok: boolean;
  rx: number;
  ry: number;
  lx: number;
  ly: number;
  /** Mean eye width in camera pixels: too small means the child is too far away. */
  eyePx: number;
}

type Status = "idle" | "starting" | "running" | "failed";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

/** Loads the runtime and model once per page; GPU when available, else CPU. */
function loadLandmarker(): Promise<FaceLandmarker> {
  landmarkerPromise ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks(WASM);
    const make = (delegate: "GPU" | "CPU") =>
      FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
      });
    return make("GPU").catch(() => make("CPU"));
  })();
  landmarkerPromise.catch(() => {
    landmarkerPromise = null; // let a later visit retry
  });
  return landmarkerPromise;
}

export class EyeTracker {
  status: Status = "idle";
  message = "";
  video: HTMLVideoElement | null = null;
  latest: EyeSample | null = null;
  /** Landmarks of the latest frame (normalised image coordinates), for drawing. */
  landmarks: NormalizedLandmark[] | null = null;
  /** Camera frames analysed per second, smoothed. */
  fps = 0;
  onSample: ((s: EyeSample) => void) | null = null;

  private stream: MediaStream | null = null;
  private landmarker: FaceLandmarker | null = null;
  private stopped = false;
  private lastTs = 0;
  private lastFrameTime = -1;
  private raf = 0;

  async start() {
    this.status = "starting";
    this.message = "Starting the camera…";
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("nocamera");
      const [stream, landmarker] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 }, facingMode: "user" },
          audio: false,
        }),
        loadLandmarker(),
      ]);
      if (this.stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      this.landmarker = landmarker;
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.srcObject = stream;
      await v.play();
      this.video = v;
      this.status = "running";
      this.message = "";
      this.loop();
    } catch (err) {
      if (this.stopped) return;
      const name = err instanceof DOMException ? err.name : "";
      this.status = "failed";
      this.message =
        name === "NotAllowedError" || name === "SecurityError"
          ? "Camera access was blocked. Allow it in the browser's site settings, then try again."
          : err instanceof Error && err.message === "nocamera"
            ? "This browser has no camera access."
            : name === "NotFoundError"
              ? "No camera found."
              : "Could not start eye tracking. Check the internet connection (the tracker downloads once) and try again.";
    }
  }

  stop() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.status = "idle";
  }

  /** Polls for new camera frames on every display frame (a detached video
   * doesn't reliably fire requestVideoFrameCallback). */
  private loop = () => {
    if (this.stopped) return;
    const v = this.video!;
    if (v.readyState >= 2 && v.currentTime !== this.lastFrameTime) {
      this.lastFrameTime = v.currentTime;
      this.analyse(v);
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private analyse(v: HTMLVideoElement) {
    const now = performance.now();
    const ts = Math.max(now, this.lastTs + 1); // MediaPipe needs strictly rising timestamps
    if (this.lastTs) {
      const inst = 1000 / (ts - this.lastTs);
      this.fps = this.fps ? this.fps * 0.9 + inst * 0.1 : inst;
    }
    this.lastTs = ts;
    const res = this.landmarker!.detectForVideo(v, ts);
    const lm = res.faceLandmarks[0];
    this.landmarks = lm ?? null;
    const sample: EyeSample = { t: now / 1000, ok: false, rx: NaN, ry: NaN, lx: NaN, ly: NaN, eyePx: 0 };
    if (lm && lm.length > 473) {
      const w = v.videoWidth;
      const h = v.videoHeight;
      const r = irisInEye(lm, EYES.right, w, h);
      const l = irisInEye(lm, EYES.left, w, h);
      const shapes = res.faceBlendshapes[0]?.categories ?? [];
      const blink = shapes.some((c) => c.categoryName.startsWith("eyeBlink") && c.score > BLINK);
      Object.assign(sample, { ok: !blink, rx: r.x, ry: r.y, lx: l.x, ly: l.y, eyePx: (r.width + l.width) / 2 });
    }
    this.latest = sample;
    this.onSample?.(sample);
  }
}

/** Iris centre relative to the midpoint of the eye corners, in eye widths, in
 * the eye's own frame (so a tilted head doesn't mix x into y). Pixel units first,
 * because normalised coordinates aren't square. */
function irisInEye(lm: NormalizedLandmark[], e: { a: number; b: number; iris: number }, w: number, h: number) {
  const ax = lm[e.a].x * w;
  const ay = lm[e.a].y * h;
  const bx = lm[e.b].x * w;
  const by = lm[e.b].y * h;
  const width = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / width;
  const uy = (by - ay) / width;
  const dx = lm[e.iris].x * w - (ax + bx) / 2;
  const dy = lm[e.iris].y * h - (ay + by) / 2;
  return { x: (dx * ux + dy * uy) / width, y: (-dx * uy + dy * ux) / width, width };
}

/** Landmarks worth drawing over the preview: corners and iris centres. */
export const EYE_POINTS = [EYES.right.a, EYES.right.b, EYES.left.a, EYES.left.b];
export const IRIS_POINTS = [EYES.right.iris, EYES.left.iris];
