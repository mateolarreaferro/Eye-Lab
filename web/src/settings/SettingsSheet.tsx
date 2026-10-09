import { useState } from "react";
import {
  ArrowSquareOut, ChartLineUp, ChatCircleText, CircleHalf, CreditCard, GearSix, Key, Minus, Plus, SpeakerHigh, type Icon,
} from "@phosphor-icons/react";
import { Sheet } from "../ui/Sheet";
import { Switch } from "../ui/Switch";
import { CALIBRATE } from "../app/catalog";
import { openGame, openPanel, useNav, type SettingsTab } from "../lib/nav";
import { isCalibrated, pxPerDeg, renamePlayer, setSetting, useLab, type Eye } from "../lib/lab";
import { DEFAULT_PARAMS, LIMITS, lodToCpd, resetParams, setParam, useFilter, type FilterParams } from "../lib/filter";
import { iris, setApiKey, keySource } from "../lib/iris";
import { sfxProps } from "../lib/sfx";
import { HistoryChart } from "../progress/HistoryChart";

/*
  Settings: General (viewing setup and app), Filters (how high-pass and
  low-pass behave), Iris (the player's Claude API key) and History.
*/

const TABS: [SettingsTab, string, Icon][] = [
  ["general", "General", GearSix],
  ["filters", "Filters", CircleHalf],
  ["iris", "Iris", ChatCircleText],
  ["history", "History", ChartLineUp],
];

export function SettingsSheet() {
  const { settingsTab } = useNav();
  return (
    <Sheet title="Settings">
      <div role="tablist" className="mb-6 grid grid-cols-4 gap-1 rounded-full bg-strong p-1">
        {TABS.map(([key, label, I]) => {
          const on = settingsTab === key;
          return (
            <button
              key={key}
              {...sfxProps}
              role="tab"
              aria-selected={on}
              onClick={() => openPanel("settings", key)}
              className={`flex h-10 items-center justify-center gap-2 rounded-full text-[14px] font-medium transition-colors duration-200 ${
                on ? "bg-card text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted hover:text-ink"
              }`}
            >
              <I size={16} weight="light" aria-hidden className="hidden sm:block" />
              {label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">
        {settingsTab === "general" && <General />}
        {settingsTab === "filters" && <Filters />}
        {settingsTab === "iris" && <IrisKey />}
        {settingsTab === "history" && <HistoryChart />}
      </div>
    </Sheet>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-card border border-hairline bg-card p-6">
      <h3 className="text-[19px] font-medium">{title}</h3>
      {note && <p className="mt-1 max-w-[56ch] text-[16px] leading-snug text-muted">{note}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <span className="text-[16px]">{label}</span>
      {children}
    </div>
  );
}

function Stepper({ what, value, onMinus, onPlus }: { what: string; value: string; onMinus: () => void; onPlus: () => void }) {
  const btn = "flex size-11 items-center justify-center rounded-full bg-card border border-hairline-strong transition-colors duration-300 hover:bg-canvas";
  return (
    <div className="flex items-center gap-2">
      <button {...sfxProps} onClick={onMinus} className={btn} aria-label={`Less ${what}`}>
        <Minus size={20} weight="bold" aria-hidden />
      </button>
      <span className="w-24 text-center text-[18px] font-medium tabular-nums" aria-live="polite">
        {value}
      </span>
      <button {...sfxProps} onClick={onPlus} className={btn} aria-label={`More ${what}`}>
        <Plus size={20} weight="bold" aria-hidden />
      </button>
    </div>
  );
}

function General() {
  const { settings } = useLab();
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return (
    <>
      <Group title="Viewing setup">
        <Row label="Distance from eyes to screen">
          <Stepper
            what="distance"
            value={`${Math.round(settings.distanceCm)} cm`}
            onMinus={() => setSetting("distanceCm", clamp(settings.distanceCm - 5, 20, 400))}
            onPlus={() => setSetting("distanceCm", clamp(settings.distanceCm + 5, 20, 400))}
          />
        </Row>
        <Row label="Eye being tested">
          <div className="flex rounded-full bg-strong p-1">
            {(["Both", "Left", "Right"] as Eye[]).map((e) => (
              <button
                key={e}
                {...sfxProps}
                onClick={() => setSetting("eye", e)}
                aria-pressed={settings.eye === e}
                className={`h-10 w-20 rounded-full text-[16px] font-medium transition-colors duration-300 ${
                  settings.eye === e ? "bg-card text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted hover:text-ink"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </Row>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-input bg-card p-4">
          <span className="max-w-[34ch] text-[16px] leading-snug text-muted">
            {isCalibrated()
              ? `Calibrated: 1° of vision is ${Math.round(pxPerDeg())} px at ${Math.round(settings.distanceCm)} cm.`
              : "Not calibrated yet, so test sizes are estimates."}
          </span>
          <button
            {...sfxProps}
            onClick={() => openGame(CALIBRATE)}
            className="flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[16px] font-medium text-card transition-colors duration-300 hover:bg-primary-hover"
          >
            <CreditCard size={20} weight="light" aria-hidden />
            Calibrate with a card
          </button>
        </div>
      </Group>
      <Group title="App">
        <label className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="text-[16px]">Player's name</span>
          <input
            name="name"
            autoComplete="nickname"
            value={settings.name}
            onChange={(e) => renamePlayer(e.target.value.slice(0, 40))}
            placeholder="Name"
            className="h-11 w-56 rounded-full bg-card px-5 text-[16px] text-ink border border-hairline-strong outline-none placeholder:text-muted-soft focus-visible:border-ink focus-visible:ring-1 focus-visible:ring-ink"
          />
        </label>
        <Row label="Daily goal with a filter on">
          <Stepper
            what="goal"
            value={`${settings.dailyGoalMin} min`}
            onMinus={() => setSetting("dailyGoalMin", clamp(settings.dailyGoalMin - 15, 15, 480))}
            onPlus={() => setSetting("dailyGoalMin", clamp(settings.dailyGoalMin + 15, 15, 480))}
          />
        </Row>
        <Row label="Sounds">
          <span className="flex items-center gap-3">
            <SpeakerHigh size={22} weight="light" className="text-muted" aria-hidden />
            <Switch on={settings.sound} onChange={(on) => setSetting("sound", on)} label="Sounds" />
          </span>
        </Row>
      </Group>
    </>
  );
}

function Filters() {
  const { params } = useFilter();
  useLab();
  return (
    <>
      <Group title="High-pass" note="Frequency patching: removes coarse shapes and keeps fine detail.">
        <ParamSlider label="Cutoff" k="hp_lod" value={params.hp_lod} />
        <ParamSlider label="Contrast boost" k="hp_gain" value={params.hp_gain} step={0.1} fmt={(v) => `${v.toFixed(1)}×`} />
        <ParamSlider label="Coarse shapes kept" k="hp_keep" value={params.hp_keep} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} />
      </Group>
      <Group title="Low-pass" note="Blurs away fine detail and keeps coarse shapes.">
        <ParamSlider label="Cutoff" k="lp_lod" value={params.lp_lod} />
        <ParamSlider label="Strength" k="lp_mix" value={params.lp_mix} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} />
      </Group>
      <div className="flex justify-end">
        <button
          {...sfxProps}
          onClick={resetParams}
          className="h-11 rounded-full bg-card px-5 text-[16px] font-medium border border-hairline-strong transition-colors duration-300 hover:bg-canvas"
        >
          Reset to defaults
        </button>
      </div>
    </>
  );
}

/** One slider bound to a filter parameter. Cutoffs run coarse to fine, left to
 * right, and show the cutoff in cycles per degree. */
function ParamSlider({ label, k, value, step = 0.25, fmt }: { label: string; k: keyof FilterParams; value: number; step?: number; fmt?: (v: number) => string }) {
  const [lo, hi] = LIMITS[k];
  const cutoff = k.endsWith("_lod");
  const shown = cutoff ? lo + hi - value : value;
  const fill = ((shown - lo) / (hi - lo)) * 100;
  const readout = cutoff ? `${lodToCpd(value).toFixed(1)} c/°` : fmt!(value);
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[160px_1fr_80px]">
      <span className="text-[16px]">{label}</span>
      <span className="text-right text-[16px] font-medium tabular-nums sm:order-last">{readout}</span>
      <div className="col-span-2 flex items-center gap-3 text-[14px] text-muted sm:col-span-1">
        {cutoff && <span>Coarse</span>}
        <input
          type="range"
          className="slider"
          min={lo}
          max={hi}
          step={step}
          value={shown}
          aria-label={label}
          aria-valuetext={cutoff ? `${lodToCpd(value).toFixed(1)} cycles per degree` : readout}
          title={value === DEFAULT_PARAMS[k] ? "Default" : undefined}
          style={{ ["--fill" as string]: `${fill}%`, ["--track-bg" as string]: "rgb(34 32 29 / 0.12)" }}
          onChange={(e) => {
            const v = Number(e.target.value);
            setParam(k, cutoff ? lo + hi - v : v);
          }}
        />
        {cutoff && <span>Fine</span>}
      </div>
    </div>
  );
}

function IrisKey() {
  const { apiKey } = iris.use();
  const [draft, setDraft] = useState(apiKey);
  const [msg, setMsg] = useState("");
  const source = keySource();

  const save = () => {
    const k = draft.trim();
    if (k && !k.startsWith("sk-ant-")) {
      setMsg("That doesn't look like a Claude API key. They start with sk-ant-.");
      return;
    }
    setApiKey(k);
    setMsg("");
  };

  return (
    <Group
      title="Claude API key"
      note="Paste a Claude API key to chat with Iris. It stays in this browser."
    >
      <label className="flex flex-col gap-2">
        <span className="flex items-center gap-2 text-[16px] font-medium">
          <Key size={20} weight="light" className="text-muted" aria-hidden />
          API key
        </span>
        <input
          type="password"
          name="api-key"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="sk-ant-…"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="iris-key-status"
          className="h-11 rounded-input bg-card px-4 font-mono text-[15px] text-ink outline-none placeholder:text-muted-soft focus-visible:border-ink focus-visible:ring-1 focus-visible:ring-ink"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          {...sfxProps}
          onClick={save}
          className="h-11 rounded-full bg-primary px-6 text-[16px] font-medium text-card transition-colors duration-300 hover:bg-primary-hover"
        >
          Save key
        </button>
        <button
          {...sfxProps}
          onClick={() => {
            setDraft("");
            setApiKey("");
          }}
          className="h-11 rounded-full bg-card px-6 text-[16px] font-medium transition-colors duration-300 hover:bg-canvas"
        >
          Remove
        </button>
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noreferrer"
          className="ml-auto flex items-center gap-1.5 text-[16px] font-medium underline-offset-4 hover:underline"
        >
          Get a key
          <ArrowSquareOut size={18} weight="bold" aria-hidden />
        </a>
      </div>
      <p id="iris-key-status" role="status" className="text-[16px] text-muted">
        {msg || (source === "own" ? `Using your key (ending in ${apiKey.slice(-4)}).` : "No key set. Iris stays off until you add one.")}
      </p>
    </Group>
  );
}
