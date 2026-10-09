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
import { AskIris } from "../iris/AskIris";
import { ProgressPage } from "../progress/ProgressPage";
import { Welcome } from "./Welcome";
import { usePlayers } from "../lib/lab";

/*
  Layers, bottom to top:
  0. Welcome: the splash and "Who's playing?", until a player is picked.
  1. The stage: Home (top bar plus the Games or My progress tab, one screen tall),
     or the running game's canvas, inside the vision filter.
  2. Chrome: a game's controls and its floating filter bar, or on Home the Ask
     Iris pill at the bottom right; never filtered.
  3. Panels: Settings and Iris, sliding in from the right.
  With Whole screen on, the helper filters everything, so the stage filter is off.
*/
export function App() {
  const { game, run, panel, tab } = useNav();
  const { current } = usePlayers();
  const { mode, wholeScreen } = useFilter();
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const filtering = mode !== 0 && !wholeScreen;

  useEffect(() => {
    return startHelperPolling();
  }, []);

  // ?game=<key> opens a game directly (a link to one game for the lab), once a player is picked.
  const [linked, setLinked] = useState(() => gameByKey(new URLSearchParams(location.search).get("game") ?? ""));
  useEffect(() => {
    if (!current || !linked) return;
    openGame(linked);
    setLinked(undefined);
  }, [current, linked]);

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
      <div
        ref={setStage}
        className={game ? "min-h-dvh" : "flex h-dvh flex-col overflow-hidden"}
        style={{ filter: filtering ? `url(#${FILTER_ID})` : undefined }}
      >
        {!game && current && <TopBar />}
        {!game && current && (tab === "games" ? <Home /> : <ProgressPage />)}
      </div>
      {game && stage && <ExerciseShell key={run} game={game} stage={stage} />}
      {game && <FilterBar />}
      {!game && current && <AskIris />}
      <AnimatePresence>
        {panel === "settings" && <SettingsSheet key="settings" />}
        {panel === "iris" && <IrisPanel key="iris" />}
      </AnimatePresence>
      <AnimatePresence>{!current && <Welcome key="welcome" />}</AnimatePresence>
    </MotionConfig>
  );
}
