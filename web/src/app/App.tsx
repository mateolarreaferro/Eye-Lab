import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig } from "motion/react";
import { Home } from "../home/Home";
import { ExerciseShell } from "../exercise/ExerciseShell";
import { FilterBar } from "../filter/FilterBar";
import { TopBar } from "../home/TopBar";
import { FILTER_ID, FilterDefs } from "../filter/FilterDefs";
import { filter, useFilter } from "../lib/filter";
import { startHelperPolling } from "../lib/helper";
import { addFilterTime } from "../lib/lab";
import { openGame, useNav } from "../lib/nav";
import { gameByKey } from "./catalog";
import { SettingsSheet } from "../settings/SettingsSheet";
import { IrisPanel } from "../iris/IrisPanel";
import { ProgressPanel } from "../progress/ProgressPanel";

/*
  Layers, bottom to top:
  1. The stage: Home with its top bar, or the running game's canvas, inside the vision filter.
  2. Chrome: a game's controls and its floating filter bar; never filtered.
  3. Panels: Settings, Progress and Iris, sliding in from the right.
  With Whole screen on, the helper filters everything, so the stage filter is off.
*/
export function App() {
  const { game, run, panel } = useNav();
  const { mode, wholeScreen } = useFilter();
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const filtering = mode !== 0 && !wholeScreen;

  useEffect(() => {
    return startHelperPolling();
  }, []);

  // ?game=<key> opens a game directly (a link to one game for the lab).
  useEffect(() => {
    const g = gameByKey(new URLSearchParams(location.search).get("game") ?? "");
    if (g) openGame(g);
  }, []);

  // Count filter time toward the daily goal while the page is visible.
  useEffect(() => {
    const id = window.setInterval(() => {
      const f = filter.get();
      if (f.mode !== 0 && !f.wholeScreen && document.visibilityState === "visible") addFilterTime(1);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <FilterDefs />
      <div ref={setStage} className="min-h-dvh" style={{ filter: filtering ? `url(#${FILTER_ID})` : undefined }}>
        {!game && <TopBar />}
        {!game && <Home />}
      </div>
      {game && stage && <ExerciseShell key={run} game={game} stage={stage} />}
      {game && <FilterBar />}
      <AnimatePresence>
        {panel === "settings" && <SettingsSheet key="settings" />}
        {panel === "progress" && <ProgressPanel key="progress" />}
        {panel === "iris" && <IrisPanel key="iris" />}
      </AnimatePresence>
    </MotionConfig>
  );
}
