/** A soft pastel bloom behind content, the only colour in the interface.
 * Pure decoration: it sits behind its siblings and never takes clicks. */
export function Orb({ a, b, className = "", drift = false }: { a: string; b?: string; className?: string; drift?: boolean }) {
  return (
    <span
      aria-hidden
      className={`orb pointer-events-none absolute ${drift ? "orb-drift" : ""} ${className}`}
      style={{ ["--orb" as string]: a, ["--orb-2" as string]: b ?? a }}
    />
  );
}
