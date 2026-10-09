import { Books, Camera, Image as ImageIcon } from "@phosphor-icons/react";
import { Exercise } from "../exercise/Exercise";
import { circle, polygon } from "../exercise/draw";
import { filter, setMode, type Mode } from "../lib/filter";
import { filterMinutesOn, lab, today } from "../lib/lab";

/*
  Frequency patching room: look at your webcam feed, a built-in "cabinet of
  curiosities", or any picture, through the vision filter. Time here counts
  toward the daily dose (the slides' protocol: a few hours a day for about four
  weeks). The stage filter does the filtering; this only draws the source.
  Port of eye_lab/exercises/patch_room.gd (camera.gdshader: mirrored feed).
*/

type Source = "camera" | "cabinet" | "image";
type RGB = [number, number, number];

interface Item {
  kind: number;
  u: number;
  shelf: number;
  s: number;
  hue: number;
  seed: number;
}

export default class PatchRoom extends Exercise {
  source: Source = "cabinet";
  prevFilter: Mode = 0;
  items: Item[] = [];
  video: HTMLVideoElement | null = null;
  stream: MediaStream | null = null;
  picture: HTMLImageElement | null = null;
  pictureUrl = "";
  input: HTMLInputElement | null = null;
  camRequest = 0;
  disposed = false;

  setup() {
    this.id = "patch_room";
    this.title = "Frequency patching room";
    this.steps = [
      "Pick what to look at: your webcam, a scene or a picture.",
      "The filter removes big blurry shapes and keeps the fine detail.",
      "Try other filters in the bar at the top, and slide Coarse ↔ Fine.",
      "Every minute here counts toward today's goal.",
    ];
    this.instructions = "";
    const rng = seeded(11);
    for (let i = 0; i < 40; i++) {
      this.items.push({
        kind: rng.int() % 6, u: rng.float(), shelf: rng.int() % 4,
        s: 0.6 + rng.float() * 0.6, hue: rng.float(), seed: rng.int(),
      });
    }
  }

  begin() {
    this.prevFilter = filter.get().mode;
    if (this.prevFilter === 0) setMode(1);
    this.setAnswers(
      [
        { id: "camera", text: "Webcam", icon: Camera, tip: "Shortcut: C" },
        { id: "scene", text: "Scene", icon: Books, tip: "Shortcut: V" },
        { id: "image", text: "Picture…", icon: ImageIcon, tip: "Shortcut: O" },
      ],
      { w: 120, h: 96 },
    );
    this.useCamera();
  }

  onAnswer(a: string | number) {
    if (a === "camera") this.useCamera();
    else if (a === "scene") {
      this.stopCamera();
      this.source = "cabinet";
      this.setStatus("Built-in scene");
    } else if (a === "image") this.openPicker();
  }

  onKey(e: KeyboardEvent) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return false;
    const map: Record<string, string> = { c: "camera", v: "scene", o: "image" };
    const a = map[e.key.toLowerCase()];
    if (!a) return false;
    this.onAnswer(a);
    return true;
  }

  // --- camera ----------------------------------------------------------------------

  useCamera() {
    this.source = "camera";
    if (this.stream) {
      this.setStatus(`Webcam: ${this.stream.getVideoTracks()[0]?.label || "camera"}`);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraFailed("No camera available in this browser. Showing the built-in scene.");
      return;
    }
    this.setStatus("Looking for a camera…");
    const req = ++this.camRequest;
    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((stream) => {
        // Gave up, picked another source or left while the prompt was open.
        if (this.disposed || req !== this.camRequest || this.source !== "camera") {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        this.stream = stream;
        const v = this.video ?? document.createElement("video");
        v.muted = true;
        v.playsInline = true;
        v.srcObject = stream;
        void v.play().catch(() => {});
        this.video = v;
        this.setStatus(`Webcam: ${stream.getVideoTracks()[0]?.label || "camera"}`);
      })
      .catch((err: unknown) => {
        if (this.disposed || req !== this.camRequest) return;
        const name = err instanceof DOMException ? err.name : "";
        this.cameraFailed(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Camera access was blocked. Allow it in your browser's site settings. Showing the built-in scene."
            : "No camera found. Showing the built-in scene.",
        );
      });
  }

  cameraFailed(msg: string) {
    if (this.source !== "camera") return;
    this.setStatus(msg);
    this.source = "cabinet";
  }

  /** Unlike the desktop app, the camera is released whenever another source is shown. */
  stopCamera() {
    this.camRequest++;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }

  // --- picture ---------------------------------------------------------------------

  openPicker() {
    if (!this.input) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.display = "none";
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        input.value = "";
        if (file) this.loadPicture(file);
      });
      document.body.appendChild(input);
      this.input = input;
    }
    this.input.click();
  }

  loadPicture(file: File) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (this.disposed) {
        URL.revokeObjectURL(url);
        return;
      }
      if (this.pictureUrl) URL.revokeObjectURL(this.pictureUrl);
      this.picture = img;
      this.pictureUrl = url;
      this.stopCamera();
      this.source = "image";
      this.setStatus(file.name);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      this.setStatus(`Could not open ${file.name}`);
    };
    img.src = url;
  }

  dispose() {
    super.dispose();
    if (this.disposed) return;
    this.disposed = true;
    this.stopCamera();
    this.input?.remove();
    if (this.pictureUrl) URL.revokeObjectURL(this.pictureUrl);
    if (this.started) setMode(this.prevFilter);
  }

  // --- drawing ---------------------------------------------------------------------

  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = "rgb(140, 128, 117)";
    g.fillRect(0, 0, this.width, this.height);
    if (!this.started) return;
    if (this.source === "camera") {
      const v = this.video;
      if (v && v.readyState >= 2 && v.videoWidth > 0) this.cover(g, v, v.videoWidth, v.videoHeight, true);
    } else if (this.source === "image" && this.picture) {
      this.cover(g, this.picture, this.picture.naturalWidth, this.picture.naturalHeight, false);
    } else if (this.source === "cabinet") {
      this.drawCabinet(g);
    }
  }

  /** Scale to cover the stage, centred; optionally mirrored like a selfie view. */
  cover(g: CanvasRenderingContext2D, src: CanvasImageSource, w: number, h: number, mirror: boolean) {
    const s = Math.max(this.width / w, this.height / h);
    const dw = w * s;
    const dh = h * s;
    g.save();
    if (mirror) {
      g.translate(this.width, 0);
      g.scale(-1, 1);
    }
    g.drawImage(src, (this.width - dw) / 2, (this.height - dh) / 2, dw, dh);
    g.restore();
  }

  /** A shelf of objects with very different spatial-frequency content (gratings,
   * checkerboards, text, smooth gradients, dots), after the paper's curated displays. */
  drawCabinet(g: CanvasRenderingContext2D) {
    const w = this.width;
    const h = this.height;
    // Floor checkerboard.
    const tile = 48;
    g.fillStyle = "rgb(64, 56, 51)";
    for (let y = Math.floor(h * 0.82); y < Math.floor(h); y += tile) {
      for (let x = 0; x < Math.floor(w); x += tile) {
        if ((Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0) g.fillRect(x, y, tile, tile);
      }
    }
    const shelfY = [h * 0.22, h * 0.42, h * 0.62, h * 0.8];
    g.fillStyle = "rgb(77, 51, 31)";
    for (const sy of shelfY) g.fillRect(w * 0.05, sy, w * 0.9, 10);

    for (const it of this.items) {
      const s = it.s * Math.min(80, Math.max(30, h * 0.07));
      const bx = w * 0.08 + it.u * w * 0.84;
      const by = shelfY[it.shelf];
      const col = hsvRgb(it.hue, 0.6, 0.8);
      switch (it.kind) {
        case 0: // sphere with a smooth gradient
          for (let i = 0; i < 12; i++) {
            circle(g, bx - i * s * 0.02, by - s - i * s * 0.03, s * (1 - i / 13), css(lighten(col, i / 14)));
          }
          break;
        case 1: {
          // striped box
          const rx = bx - s * 0.8;
          const ry = by - s * 1.6;
          const rs = s * 1.6;
          g.fillStyle = css(col);
          g.fillRect(rx, ry, rs, rs);
          g.fillStyle = css(darken(col, 0.6));
          for (let i = 0; i < 8; i++) g.fillRect(rx + (i * rs) / 8, ry, rs / 16, rs);
          break;
        }
        case 2: {
          // checkerboard cube
          const n = 6;
          const c = (s * 1.4) / n;
          for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
              g.fillStyle = (i + j) % 2 === 0 ? "rgb(242, 242, 242)" : "rgb(26, 26, 26)";
              g.fillRect(bx - s * 0.7 + i * c, by - s * 1.4 + j * c, c, c);
            }
          }
          break;
        }
        case 3: {
          // book with text
          g.fillStyle = "rgb(242, 237, 217)";
          g.fillRect(bx - s * 0.6, by - s * 1.8, s * 1.2, s * 1.8);
          g.fillStyle = "rgb(38, 38, 38)";
          g.font = `${Math.floor(Math.max(6, s * 0.2))}px "Figtree Variable", system-ui, sans-serif`;
          g.textBaseline = "alphabetic";
          g.textAlign = "left";
          for (let i = 0; i < 6; i++) g.fillText("the quick fox", bx - s * 0.55, by - s * 1.6 + i * s * 0.28, s * 1.1);
          break;
        }
        case 4: {
          // speckled stone
          const rng = seeded(it.seed);
          const cy = by - s * 0.6;
          circle(g, bx, cy, s * 0.7, css(darken(col, 0.3)));
          for (let i = 0; i < 60; i++) {
            const a = rng.float() * Math.PI * 2;
            const r = rng.float() * s * 0.65;
            circle(g, bx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.max(1, s * 0.03), "rgb(242, 242, 230)");
          }
          break;
        }
        case 5: {
          // vase outline
          const pts: [number, number][] = [];
          const half = (t: number) => s * (0.3 + 0.35 * Math.sin(t * Math.PI * 1.3));
          for (let i = 0; i < 20; i++) pts.push([bx + half(i / 19), by - (i / 19) * s * 2]);
          for (let i = 19; i >= 0; i--) pts.push([bx - half(i / 19), by - (i / 19) * s * 2]);
          polygon(g, pts, css(col));
          break;
        }
      }
    }
  }

  summary() {
    const d = lab.get();
    return {
      text: `Filter time today: ${Math.floor(filterMinutesOn(d, today()))} min of your ${Math.floor(d.settings.dailyGoalMin)} min goal.`,
    };
  }
}

/** Small seeded PRNG (mulberry32) so the scene looks the same every time. */
function seeded(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  return { int: next, float: () => next() / 4294967296 };
}

function hsvRgb(h: number, s: number, v: number): RGB {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  return ([[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]] as RGB[])[((i % 6) + 6) % 6];
}

const lighten = (c: RGB, k: number): RGB => [c[0] + (1 - c[0]) * k, c[1] + (1 - c[1]) * k, c[2] + (1 - c[2]) * k];
const darken = (c: RGB, k: number): RGB => [c[0] * (1 - k), c[1] * (1 - k), c[2] * (1 - k)];
const css = (c: RGB) => `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;
