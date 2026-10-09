import { useMemo, useState } from "react";
import { ChartLineUp } from "@phosphor-icons/react";
import { BETTER, resultsFor, useLab } from "../lib/lab";

/** Test history: pick a measure, see every session as a line, with which way is better. */
export function HistoryChart() {
  const data = useLab();
  const ids = useMemo(() => [...new Set(data.results.map((r) => r.id))], [data.results]);
  const [picked, setPicked] = useState<string>("");
  const id = ids.includes(picked) ? picked : ids[0];

  const ink = "var(--color-ink)";

  if (!id) {
    return (
      <div className="flex flex-col items-center rounded-card border border-hairline bg-card p-10 text-center">
        <ChartLineUp size={36} weight="light" className="text-muted-soft" aria-hidden />
        <p className="mt-3 text-[19px] font-medium">No results yet</p>
      </div>
    );
  }

  const rows = resultsFor(data, id).slice(-30);
  const vals = rows.map((r) => r.value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 1e-6) {
    lo -= 1;
    hi += 1;
  }
  const W = 520;
  const H = 220;
  const P = 28;
  const x = (i: number) => (vals.length > 1 ? P + ((W - 2 * P) * i) / (vals.length - 1) : W / 2);
  const y = (v: number) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const first = rows[0];

  return (
    <div className="rounded-card border border-hairline bg-card p-6">
      <label className="mb-4 flex flex-col gap-2">
        <span className="text-[16px] font-medium">Test results</span>
        <select
          value={id}
          onChange={(e) => setPicked(e.target.value)}
          className="h-12 rounded-input bg-card px-3 text-[16px] text-ink border border-hairline-strong outline-none focus-visible:border-ink focus-visible:ring-1 focus-visible:ring-ink"
        >
          {ids.map((i) => {
            const r = resultsFor(data, i)[0];
            return (
              <option key={i} value={i} className="text-ink">
                {r.title} ({r.unit})
              </option>
            );
          })}
        </select>
      </label>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${first.title} over ${vals.length} sessions`}>
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={P} x2={W - P} y1={P + f * (H - 2 * P)} y2={P + f * (H - 2 * P)} stroke={ink} strokeOpacity={0.12} />
        ))}
        <text x={2} y={P + 4} fontSize={13} fill={ink} fillOpacity={0.6}>
          {hi.toFixed(2)}
        </text>
        <text x={2} y={H - P + 4} fontSize={13} fill={ink} fillOpacity={0.6}>
          {lo.toFixed(2)}
        </text>
        {vals.length > 1 && (
          <polyline points={vals.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinejoin="round" />
        )}
        {vals.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={4} fill="var(--color-primary)">
            <title>
              {rows[i].date}: {v.toFixed(2)} {rows[i].unit}
            </title>
          </circle>
        ))}
      </svg>
      <p className="mt-2 text-[15px] text-muted">
        {vals.length} {vals.length === 1 ? "session" : "sessions"}, {BETTER[id] === "higher" ? "higher" : "lower"} is better
      </p>
    </div>
  );
}
