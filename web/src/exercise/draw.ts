/*
  Stimulus drawing shared by the games, in canvas 2D. Port of
  eye_lab/core/draw_util.gd. Colours are CSS strings.
*/

export const SHAPES = ["circle", "square", "triangle", "diamond", "star", "cross", "ring", "hexagon"] as const;
export type ShapeKind = (typeof SHAPES)[number];

/** Tumbling E. dir: 0 = opening right, 1 = down, 2 = left, 3 = up. */
export function tumblingE(g: CanvasRenderingContext2D, cx: number, cy: number, size: number, dir: number, color: string) {
  const u = size / 5;
  g.save();
  g.translate(cx, cy);
  g.rotate((dir * Math.PI) / 2);
  g.fillStyle = color;
  const o = -size / 2;
  g.fillRect(o, o, u, size);
  for (const row of [0, 2, 4]) g.fillRect(o, o + row * u, size, u);
  g.restore();
}

export function starPoints(cx: number, cy: number, rOut: number, rIn: number, n: number, rot = -Math.PI / 2): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = rot + (i * Math.PI) / n;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

export function regularPoints(cx: number, cy: number, r: number, n: number, rot = -Math.PI / 2): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 2 * Math.PI) / n;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

export function polygon(g: CanvasRenderingContext2D, pts: [number, number][], color: string) {
  g.fillStyle = color;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
}

export function circle(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
  g.fill();
}

export function ring(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, width: number) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
  g.stroke();
}

export function line(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, width = 2) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}

/** The yellow "spot of light" from the slides. */
export function sun(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  polygon(g, starPoints(cx, cy, r, r * 0.55, 8), "rgb(255, 184, 13)");
  circle(g, cx, cy, r * 0.38, "#ffffff");
}

export function shape(g: CanvasRenderingContext2D, kind: ShapeKind, cx: number, cy: number, r: number, color: string) {
  switch (kind) {
    case "circle":
      circle(g, cx, cy, r, color);
      break;
    case "square":
      g.fillStyle = color;
      g.fillRect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
      break;
    case "triangle":
      polygon(g, regularPoints(cx, cy + r * 0.15, r * 1.1, 3), color);
      break;
    case "diamond":
      polygon(g, regularPoints(cx, cy, r * 1.05, 4), color);
      break;
    case "star":
      polygon(g, starPoints(cx, cy, r * 1.1, r * 0.48, 5), color);
      break;
    case "cross":
      g.fillStyle = color;
      g.fillRect(cx - r, cy - r * 0.33, r * 2, r * 0.66);
      g.fillRect(cx - r * 0.33, cy - r, r * 0.66, r * 2);
      break;
    case "ring":
      ring(g, cx, cy, r * 0.78, color, r * 0.44);
      break;
    case "hexagon":
      polygon(g, regularPoints(cx, cy, r, 6, 0), color);
      break;
  }
}

export function fixation(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, color = "#ffffff") {
  line(g, cx - s, cy, cx + s, cy, color, 2);
  line(g, cx, cy - s, cx, cy + s, color, 2);
}

/** "r, g, b" from HSV (h in 0..1), for the colour games. */
export function hsv(h: number, s: number, v: number): string {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}
