import { sigmaFor, useFilter } from "../lib/filter";

export const FILTER_ID = "eyelab-filter";

/*
  The page filter as SVG primitives, applied with CSS `filter: url(#eyelab-filter)`.
  The math matches shaders/filter.gdshader and the helper:

    high-pass  o = 0.5 + gain * (c - b) + keep * (b - 0.5)
    low-pass   o = mix(c, b, amount)

  where b is a Gaussian blur of the image c. SVG clamps every intermediate to
  0..1 and keeps colour at or below alpha, so high-pass is built in steps that
  never leave that range: first 0.5 + 0.5 (c - b) as an equal blend of c and the
  inverted blur, then the gain as a contrast stretch around 0.5, then the kept
  share of the coarse image added on top (alpha may overshoot there, and clamps
  back to 1, which is harmless).
*/
export function FilterDefs() {
  const { mode, params } = useFilter();
  const lod = mode === 2 ? params.lp_lod : params.hp_lod;
  const sigma = sigmaFor(lod).toFixed(2);
  const g = params.hp_gain;
  const keep = params.hp_keep;
  const m = params.lp_mix;

  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <filter
        id={FILTER_ID}
        x="0"
        y="0"
        width="1"
        height="1"
        filterUnits="objectBoundingBox"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur in="SourceGraphic" stdDeviation={sigma} edgeMode="duplicate" result="blur" />
        {mode === 2 ? (
          <feComposite in="SourceGraphic" in2="blur" operator="arithmetic" k1="0" k2={1 - m} k3={m} k4="0" />
        ) : (
          <>
            <feComponentTransfer in="blur" result="inv">
              <feFuncR type="table" tableValues="1 0" />
              <feFuncG type="table" tableValues="1 0" />
              <feFuncB type="table" tableValues="1 0" />
            </feComponentTransfer>
            <feComposite in="SourceGraphic" in2="inv" operator="arithmetic" k1="0" k2="0.5" k3="0.5" k4="0" result="half" />
            <feComponentTransfer in="half" result="hp">
              <feFuncR type="linear" slope={2 * g} intercept={0.5 - g} />
              <feFuncG type="linear" slope={2 * g} intercept={0.5 - g} />
              <feFuncB type="linear" slope={2 * g} intercept={0.5 - g} />
            </feComponentTransfer>
            {keep > 0 && (
              <feComposite in="hp" in2="blur" operator="arithmetic" k1="0" k2="1" k3={keep} k4={-0.5 * keep} />
            )}
          </>
        )}
      </filter>
    </svg>
  );
}
