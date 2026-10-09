import { motion } from "motion/react";
import { play } from "../lib/sfx";

/** An on/off switch: ink track when on, hairline grey when off, white knob. */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => {
        play("click");
        onChange(!on);
      }}
      className="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200"
      style={{ background: on ? "var(--color-primary)" : "var(--color-hairline-strong)" }}
    >
      <motion.span
        className="absolute top-1 left-1 size-5 rounded-full bg-card shadow-[0_1px_2px_rgb(0_0_0/0.2)]"
        animate={{ x: on ? 20 : 0 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      />
    </button>
  );
}
