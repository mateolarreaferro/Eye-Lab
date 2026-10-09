import {
  Binoculars, Clock, Eyeglasses, Flame, Flask, GameController, Lock, Play, Sun, Trophy, type Icon,
} from "@phosphor-icons/react";
import { Sheet } from "../ui/Sheet";
import { IconPlate } from "../ui/IconPlate";
import { Orb } from "../ui/Orb";
import { bestFilterDay, dateAgo, filterMinutesOn, longestStreak, playsByGame, resultsFor, streak, useLab } from "../lib/lab";
import { HistoryChart } from "./HistoryChart";

/** Progress: the numbers, a week of filter time, test history and badges. */
export function ProgressPanel() {
  const data = useLab();
  const goal = data.settings.dailyGoalMin;
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = dateAgo(6 - i);
    return { date, min: filterMinutesOn(data, date) };
  });
  const top = Math.max(goal, ...week.map((d) => d.min));
  const plays = playsByGame(data);
  const testsDone = ["acuity", "contrast", "field_map"].filter((t) => resultsFor(data, t).length > 0).length;
  const best = bestFilterDay(data);
  const longest = longestStreak(data);

  const badges: [string, string, boolean, Icon][] = [
    ["First steps", "Play your first game", data.sessions.length >= 1, Play],
    ["On a roll", "Play 3 days in a row", longest >= 3, Flame],
    ["Week warrior", "Play 7 days in a row", longest >= 7, Sun],
    ["Magic eyes", "30 minutes of filter time in a day", best >= 30, Eyeglasses],
    ["Full dose", "Reach your daily filter goal", best >= goal, Clock],
    ["Explorer", "Try 8 different games", Object.keys(plays).length >= 8, Binoculars],
    ["Scientist", "Finish all 3 eye check-up tests", testsDone >= 3, Flask],
    ["Trophy hunter", "Win 50 trophies", data.stars >= 50, Trophy],
  ];

  const stats: [string, string | number, Icon, string, string][] = [
    ["Trophies", data.stars, Trophy, "var(--color-orb-2)", "var(--color-orb-5)"],
    ["Days in a row", streak(data), Flame, "var(--color-orb-5)", "var(--color-orb-3)"],
    ["Games played", data.sessions.length, GameController, "var(--color-orb-1)", "var(--color-orb-4)"],
    ["Filter minutes this week", Math.round(week.reduce((s, d) => s + d.min, 0)), Clock, "var(--color-orb-4)", "var(--color-orb-3)"],
  ];

  return (
    <Sheet title="Progress" orb={["var(--color-orb-1)", "var(--color-orb-4)"]} wide>
      <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value, I, a, b]) => (
          <div key={label} className="relative isolate flex min-h-36 flex-col justify-between gap-3 overflow-hidden rounded-card border border-hairline bg-card p-4">
            <Orb a={a} b={b} className="top-[-40%] right-[-40%] -z-10 h-[120%] w-[120%] opacity-50" />
            <I size={24} weight="light" aria-hidden />
            <dd className="display text-[40px] tabular-nums">{value}</dd>
            <dt className="text-[15px] leading-tight text-muted">{label}</dt>
          </div>
        ))}
      </dl>

      <section className="mb-4 rounded-card border border-hairline bg-card p-6">
        <h3 className="text-[20px] font-medium">Filter time</h3>
        <p className="mt-1 text-[16px] text-muted">Minutes with a filter on, last 7 days. Goal {goal} minutes a day.</p>
        <div
          className="mt-5 flex h-44 items-end gap-2"
          role="img"
          aria-label={week.map((d) => `${d.date}: ${Math.round(d.min)} minutes`).join(", ")}
        >
          {week.map((d) => (
            <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <span className="text-[14px] text-muted tabular-nums">{d.min >= 1 ? Math.round(d.min) : ""}</span>
              <div
                className="w-full rounded-[8px]"
                style={{
                  height: `${Math.max(3, (d.min / top) * 100)}%`,
                  background: d.min >= goal ? "var(--color-primary)" : d.min > 0 ? "var(--color-orb-4)" : "var(--color-hairline)",
                }}
              />
              <span className="text-[14px] text-muted">{new Date(d.date + "T12:00").toLocaleDateString(undefined, { weekday: "short" })}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-4">
        <HistoryChart />
      </div>

      <section className="rounded-card border border-hairline bg-card p-6">
        <h3 className="text-[20px] font-medium">Badges</h3>
        <p className="mt-1 text-[16px] text-muted">
          {badges.filter((b) => b[2]).length} of {badges.length} earned
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {badges.map(([name, how, got, I]) => (
            <div key={name} className={`flex items-center gap-4 rounded-input p-3 ${got ? "bg-canvas" : ""}`}>
              {got ? (
                <IconPlate icon={I} size={44} />
              ) : (
                <span className="opacity-50"><IconPlate icon={Lock} size={44} /></span>
              )}
              <span>
                <span className={`block text-[17px] font-medium ${got ? "" : "text-muted"}`}>
                  {name}
                  <span className="sr-only">{got ? ", earned" : ", locked"}</span>
                </span>
                <span className="block text-[15px] text-muted">{how}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </Sheet>
  );
}
