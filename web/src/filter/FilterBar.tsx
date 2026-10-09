import { MODE_TIPS, lodToCpd, lodKey, setCutoff, setMode, useFilter, type Mode } from "../lib/filter";
import { useLab } from "../lib/lab";
import { sfxProps } from "../lib/sfx";

/*
  The filter control: no filter, high-pass or low-pass, and the cutoff slider
  of the current filter (coarse to fine, left to right). On Home it sits in the
  top bar; during a game it floats at the top centre. Both are outside the
  filtered stage, so they always stay readable. The other sliders live in
  Settings > Filters.
*/

const LABELS = ["No filter", "High-pass", "Low-pass"];

export function FilterControl() {
  const { mode, params, wholeScreen } = useFilter();
  useLab(); // the cycles-per-degree label depends on distance and calibration
  const lod = params[lodKey(mode)];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <div role="radiogroup" aria-label="Filter" className="flex rounded-full bg-strong p-1">
        {LABELS.map((name, i) => {
          const on = mode === i;
          return (
            <button
              key={name}
              {...sfxProps}
              role="radio"
              aria-checked={on}
              title={MODE_TIPS[i]}
              onClick={() => setMode(i as Mode)}
              className={`h-8 rounded-full px-3.5 text-[14px] font-medium transition-colors duration-200 ${
                on ? "bg-card text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted hover:text-ink"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
      {mode !== 0 && (
        <label className="flex items-center gap-3 text-[14px] text-muted">
          Coarse
          <input
            type="range"
            className="slider w-28"
            min={0.5}
            max={7}
            step={0.25}
            value={7.5 - lod}
            style={{ ["--fill" as string]: `${((7 - lod) / 6.5) * 100}%` }}
            onChange={(e) => setCutoff(7.5 - Number(e.target.value))}
            aria-label="Cutoff, coarse to fine"
            aria-valuetext={`${lodToCpd(lod).toFixed(1)} cycles per degree`}
            title="Which detail sizes the filter splits at. More options in Settings, Filters."
          />
          Fine
          <span className="w-16 whitespace-nowrap tabular-nums">{lodToCpd(lod).toFixed(1)}&nbsp;c/°</span>
        </label>
      )}
      {wholeScreen && <span className="label !text-ink">Whole screen on</span>}
    </div>
  );
}

/** The floating version shown during a game. */
export function FilterBar() {
  return (
    <div className="fixed top-20 left-1/2 z-30 -translate-x-1/2 rounded-full border border-hairline bg-card/95 p-1.5 pr-4 shadow-soft backdrop-blur-md sm:top-4">
      <FilterControl />
    </div>
  );
}
