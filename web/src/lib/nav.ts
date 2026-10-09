import { createStore } from "./store";
import type { GameDef } from "../app/catalog";

/** Which screen and which overlay are showing. No router: the app is one page. */
export type Panel = null | "settings" | "iris";
/** Home's two tabs. */
export type Tab = "games" | "progress";
export type SettingsTab = "general" | "filters" | "iris" | "history";

interface Nav {
  game: GameDef | null;
  /** Increments to restart the same game ("Play again"). */
  run: number;
  panel: Panel;
  tab: Tab;
  settingsTab: SettingsTab;
}

export const nav = createStore<Nav>({ game: null, run: 0, panel: null, tab: "games", settingsTab: "general" });
export const useNav = nav.use;

export const openGame = (game: GameDef) => nav.set((n) => ({ ...n, game, run: n.run + 1, panel: null }));
export const goHome = () => nav.set((n) => ({ ...n, game: null }));
export const openPanel = (panel: Panel, settingsTab?: SettingsTab) =>
  nav.set((n) => ({ ...n, panel, settingsTab: settingsTab ?? n.settingsTab }));
export const closePanel = () => nav.set((n) => ({ ...n, panel: null }));
export const openTab = (tab: Tab) => nav.set((n) => ({ ...n, game: null, panel: null, tab }));
