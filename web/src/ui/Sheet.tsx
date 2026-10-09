import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { X } from "@phosphor-icons/react";
import { closePanel } from "../lib/nav";
import { sfxProps } from "../lib/sfx";
import { Orb } from "./Orb";

/** A calm white panel that fades in at the right over a soft scrim. Esc or the scrim closes it. */
export function Sheet({
  title,
  orb = ["var(--color-orb-4)", "var(--color-orb-3)"],
  children,
  wide = false,
}: {
  title: string;
  /** The two pastel stops of the faint orb behind the header. */
  orb?: [string, string];
  children: React.ReactNode;
  wide?: boolean;
}) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    // Move focus into the sheet, keep Tab inside it, and give it back on close.
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () =>
      [...(panel.current?.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? [])].filter(
        (el) => !el.hasAttribute("disabled"),
      );
    if (!panel.current?.contains(document.activeElement)) focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50">
      <motion.div
        className="absolute inset-0 bg-ink/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closePanel}
      />
      <motion.aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
        animate={{ x: 0, opacity: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className={`absolute inset-y-0 right-0 isolate flex w-full flex-col overflow-hidden border-l border-hairline bg-canvas text-ink ${wide ? "max-w-[780px]" : "max-w-[620px]"}`}
      >
        <header className="flex items-center gap-4 p-6 lg:p-8">
          <Orb a={orb[0]} b={orb[1]} className="top-[-140px] right-[-80px] -z-10 h-[300px] w-[420px] opacity-60" />
          <h2 className="display flex-1 text-[36px]">{title}</h2>
          <button
            {...sfxProps}
            onClick={closePanel}
            aria-label="Close"
            className="flex size-10 items-center justify-center rounded-full border border-hairline-strong bg-card/70 transition-colors duration-200 hover:bg-card"
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-8 lg:px-8">{children}</div>
      </motion.aside>
    </div>
  );
}
