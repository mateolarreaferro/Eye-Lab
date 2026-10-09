import { lab } from "./lab";

/*
  Interface sounds, synthesised with Web Audio (no files): very short, high,
  quiet sine taps whose pitch drops quickly. A faint tick on hover, a fuller
  tick on press, a double tick for a correct answer, one lower tick for a miss,
  three rising ticks on finishing. Never noise. Port of autoload/sfx.gd.
*/

type Tap = [start: number, f0: number, f1: number, glide: number, decay: number, amp: number];

const SOUNDS: Record<string, { duration: number; taps: Tap[]; gain?: number }> = {
  hover: { duration: 0.03, taps: [[0, 2400, 1500, 0.004, 0.004, 0.05]], gain: 0.4 },
  click: { duration: 0.04, taps: [[0, 2200, 1700, 0.003, 0.007, 0.09]] },
  success: { duration: 0.12, taps: [[0, 2000, 1600, 0.003, 0.008, 0.08], [0.06, 2600, 2100, 0.003, 0.01, 0.08]] },
  fail: { duration: 0.07, taps: [[0, 1300, 1100, 0.003, 0.012, 0.08]] },
  complete: {
    duration: 0.22,
    taps: [[0, 1800, 1450, 0.003, 0.01, 0.07], [0.07, 2200, 1800, 0.003, 0.01, 0.07], [0.14, 2700, 2200, 0.003, 0.014, 0.07]],
  },
};

let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
let lastHover = 0;

function render(name: string): AudioBuffer {
  const spec = SOUNDS[name];
  const rate = ctx!.sampleRate;
  const n = Math.floor(spec.duration * rate);
  const buf = ctx!.createBuffer(1, n, rate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let v = 0;
    for (const [start, f0, f1, glide, decay, amp] of spec.taps) {
      const u = t - start;
      if (u < 0) continue;
      const phase = 2 * Math.PI * (f1 * u + (f0 - f1) * glide * (1 - Math.exp(-u / glide)));
      const attack = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, u / 0.0012));
      v += Math.sin(phase) * attack * Math.exp(-u / decay) * amp;
    }
    data[i] = v * Math.min(1, (spec.duration - t) / 0.006) * (spec.gain ?? 1);
  }
  return buf;
}

export function play(name: keyof typeof SOUNDS | string) {
  if (!lab.get().settings.sound || !SOUNDS[name]) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    if (!buffers.has(name)) buffers.set(name, render(name));
    const src = ctx.createBufferSource();
    src.buffer = buffers.get(name)!;
    src.playbackRate.value = 0.98 + Math.random() * 0.04;
    src.connect(ctx.destination);
    src.start();
  } catch {
    /* no audio available */
  }
}

/** Hover ticks are rate-limited so sweeping across tiles doesn't rattle. */
export function hover() {
  const now = performance.now();
  if (now - lastHover < 50) return;
  lastHover = now;
  play("hover");
}

/** Props that give any button the hover and press ticks. */
export const sfxProps = {
  onPointerEnter: () => hover(),
  onPointerDown: () => play("click"),
};
