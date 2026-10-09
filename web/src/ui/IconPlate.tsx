import type { Icon } from "@phosphor-icons/react";

/** A round plate holding one thin ink icon, like a voice icon in a library row. */
export function IconPlate({ icon: I, size = 44, onCard = false }: { icon: Icon; size?: number; onCard?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-ink ${onCard ? "bg-card/80 backdrop-blur-sm" : "bg-strong"}`}
      style={{ width: size, height: size }}
    >
      <I size={Math.round(size * 0.5)} weight="light" />
    </span>
  );
}
