import { useEffect, useRef } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { EYE_POINTS, IRIS_POINTS } from "../lib/eyeTracker";
import { sessionLandmarks, sessionVideo, useSessionEyes } from "../lib/sessionEyes";

/** On the how-to-play card while eye tracking is on: a small mirrored camera
 * view with the tracked eye points, so a helper can seat the child before Start. */
export function EyeCheck() {
  const live = useSessionEyes();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = ref.current;
      const v = sessionVideo();
      if (c && v && v.readyState >= 2 && v.videoWidth) {
        const dpr = window.devicePixelRatio || 1;
        const w = c.clientWidth;
        const h = c.clientHeight;
        if (c.width !== Math.round(w * dpr)) {
          c.width = Math.round(w * dpr);
          c.height = Math.round(h * dpr);
        }
        const g = c.getContext("2d")!;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        // Cover the box, mirrored like a selfie view.
        const s = Math.max(w / v.videoWidth, h / v.videoHeight);
        const dw = v.videoWidth * s;
        const dh = v.videoHeight * s;
        const ox = (w - dw) / 2;
        const oy = (h - dh) / 2;
        g.save();
        g.translate(w, 0);
        g.scale(-1, 1);
        g.drawImage(v, ox, oy, dw, dh);
        const lm = sessionLandmarks();
        if (lm) {
          const dot = (i: number, r: number, color: string) => {
            g.fillStyle = color;
            g.beginPath();
            g.arc(ox + lm[i].x * dw, oy + lm[i].y * dh, r, 0, Math.PI * 2);
            g.fill();
          };
          for (const i of EYE_POINTS) dot(i, 2.5, "#55c1f2");
          for (const i of IRIS_POINTS) {
            dot(i, 3.5, "#ffffff");
            dot(i, 2, "#161c32");
          }
        }
        g.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  const text =
    live.status === "failed"
      ? live.message
      : live.status !== "running"
        ? "Starting the camera…"
        : live.seeing
          ? "Eyes found. Eye tracking will record this game."
          : "Looking for the eyes. Sit facing the camera, in good light.";

  return (
    <div className="mt-6 flex items-center gap-4 rounded-card border border-hairline bg-card p-3">
      <canvas ref={ref} aria-hidden className="h-[72px] w-[128px] shrink-0 rounded-[10px] bg-strong" />
      <p className="flex items-start gap-2 text-[15px] leading-snug text-body" aria-live="polite">
        {live.seeing ? (
          <Eye size={20} weight="light" className="mt-0.5 shrink-0 text-accent-deep" aria-hidden />
        ) : (
          <EyeSlash size={20} weight="light" className="mt-0.5 shrink-0 text-muted" aria-hidden />
        )}
        {text}
      </p>
    </div>
  );
}

/** During play: a quiet chip saying whether the eyes are being seen. */
export function EyeChip() {
  const live = useSessionEyes();
  if (live.status === "off") return null;
  const ok = live.status === "running" && live.seeing;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-30 flex items-center gap-2 rounded-full bg-card/90 px-4 py-2 text-[14px] text-body"
    >
      <span className={`size-2 rounded-full ${ok ? "bg-accent" : "bg-muted-soft"}`} aria-hidden />
      {live.status === "failed" ? "Eye tracking off" : ok ? "Eye tracking" : "Can't see the eyes"}
    </div>
  );
}
