import type { ChartData } from "../lib/report";

/*
  A chart Iris draws into the chat (show_chart): one series, so no legend; navy
  marks on a white card, a recessive grid, first and last values labelled, every
  mark with a hover title, and the same numbers in a screen-reader table.
*/

const W = 480;
const H = 200;
const PAD = { top: 20, right: 16, bottom: 28, left: 40 };

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, ""));
const day = (date: string, opts: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00`).toLocaleDateString(undefined, opts);

export function ChatChart({ chart }: { chart: ChartData }) {
  const { points, form, unit } = chart;
  const vals = points.map((p) => p.value);
  const ink = "var(--color-ink)";
  const navy = "var(--color-primary)";
  const x0 = PAD.left;
  const x1 = W - PAD.right;
  const y0 = PAD.top;
  const y1 = H - PAD.bottom;

  let lo = form === "bars" ? 0 : Math.min(...vals);
  let hi = Math.max(...vals, chart.goal ?? 0);
  if (hi - lo < 1e-6) {
    lo = form === "bars" ? 0 : lo - 1;
    hi = form === "bars" ? Math.max(1, hi) : hi + 1;
  }
  const y = (v: number) => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);
  const n = points.length;
  const xLine = (i: number) => (n > 1 ? x0 + ((x1 - x0) * i) / (n - 1) : (x0 + x1) / 2);
  const slot = (x1 - x0) / Math.max(1, n);
  const barW = Math.max(3, Math.min(28, slot - 2));
  const xBar = (i: number) => x0 + slot * i + (slot - barW) / 2;

  const last = n - 1;
  const dateFmt: Intl.DateTimeFormatOptions = form === "bars" && n <= 14 ? { weekday: "short" } : { month: "short", day: "numeric" };

  return (
    <figure className="w-full max-w-[520px] self-start rounded-card border border-hairline bg-card p-4">
      <figcaption>
        <span className="block text-[16px] font-medium">{chart.title}</span>
        <span className="block text-[14px] text-muted">{chart.subtitle}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" aria-hidden>
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={x0} x2={x1} y1={y0 + f * (y1 - y0)} y2={y0 + f * (y1 - y0)} stroke={ink} strokeOpacity={0.1} />
        ))}
        <text x={x0 - 6} y={y0 + 4} fontSize={12} textAnchor="end" fill={ink} fillOpacity={0.6}>
          {fmt(hi)}
        </text>
        <text x={x0 - 6} y={y1 + 4} fontSize={12} textAnchor="end" fill={ink} fillOpacity={0.6}>
          {fmt(lo)}
        </text>
        <text x={form === "bars" ? xBar(0) : x0} y={H - 8} fontSize={12} fill={ink} fillOpacity={0.6}>
          {day(points[0].date, dateFmt)}
        </text>
        {n > 1 && (
          <text x={form === "bars" ? xBar(last) + barW : x1} y={H - 8} fontSize={12} textAnchor="end" fill={ink} fillOpacity={0.6}>
            {day(points[last].date, dateFmt)}
          </text>
        )}

        {form === "line" && (
          <>
            {n > 1 && (
              <polyline
                points={points.map((p, i) => `${xLine(i)},${y(p.value)}`).join(" ")}
                fill="none"
                stroke={navy}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {points.map((p, i) => (
              <circle key={i} cx={xLine(i)} cy={y(p.value)} r={4.5} fill={navy} stroke="var(--color-card)" strokeWidth={2}>
                <title>
                  {p.date}: {fmt(p.value)} {unit}
                </title>
              </circle>
            ))}
            {[0, last].filter((i, k) => k === 0 || i !== 0).map((i) => (
              <text
                key={i}
                x={xLine(i)}
                y={y(points[i].value) - 10}
                fontSize={12}
                fontWeight={600}
                textAnchor={i === 0 && n > 1 ? "start" : i === last && n > 1 ? "end" : "middle"}
                fill={ink}
              >
                {fmt(points[i].value)}
              </text>
            ))}
          </>
        )}

        {form === "bars" && (
          <>
            {points.map((p, i) => {
              const h = Math.max(p.value > 0 ? 3 : 1.5, y1 - y(p.value));
              const reached = chart.goal !== undefined && p.value >= chart.goal;
              return (
                <rect
                  key={i}
                  x={xBar(i)}
                  y={y1 - h}
                  width={barW}
                  height={h}
                  rx={Math.min(4, barW / 2)}
                  fill={p.value > 0 ? navy : ink}
                  fillOpacity={p.value > 0 ? (reached || chart.goal === undefined ? 1 : 0.55) : 0.15}
                >
                  <title>
                    {p.date}: {fmt(p.value)} {unit}
                  </title>
                </rect>
              );
            })}
            {chart.goal !== undefined && chart.goal <= hi && (
              <>
                <line x1={x0} x2={x1} y1={y(chart.goal)} y2={y(chart.goal)} stroke="var(--color-accent-deep)" strokeWidth={1.5} strokeDasharray="4 4" />
                <text x={x0 + 2} y={y(chart.goal) - 5} fontSize={12} fill="var(--color-accent-deep)">
                  goal {fmt(chart.goal)}
                </text>
              </>
            )}
          </>
        )}
      </svg>
      <table className="sr-only">
        <caption>{chart.title}</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>{unit}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td>{p.date}</td>
              <td>{fmt(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
