import {
  Binoculars, Clock, Eyeglasses, Flame, Flask, GameController, Lock, Play, Sun, Trophy, type Icon,
} from "@phosphor-icons/react";
import { IconPlate } from "../ui/IconPlate";
import { Orb } from "../ui/Orb";
import { bestFilterDay, dateAgo, filterMinutesOn, longestStreak, playsByGame, resultsFor, streak, useLab } from "../lib/lab";
import { HistoryChart } from "./HistoryChart";

/** Home's My progress tab: the numbers, a week of filter time, test history,
 * what eye tracking saw, and badges. Scrolls inside the tab; the bar stays put. */
export function ProgressPage() {
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
    <main id="main" role="tabpanel" aria-label="My progress" className="relative isolate min-h-0 flex-1 overflow-y-auto bg-canvas text-ink">
      <Orb a="var(--color-orb-1)" b="var(--color-orb-4)" drift className="top-[-260px] right-[-120px] -z-10 h-[560px] w-[760px] opacity-60" />
      <div className="mx-auto w-full max-w-[1280px] px-4 pt-6 pb-12 sm:px-8 lg:pt-8">
      <h1 className="display mb-6 text-[clamp(2rem,4vw,3rem)] text-balance">
        {data.settings.name}'s <span className="text-accent">progress</span>
      </h1>
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

      <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-card border border-hairline bg-card p-6">
        <h3 className="text-[20px] font-medium">Filter time</h3>
        <p className="mt-1 text-[16px] text-muted">Last 7 days</p>
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

      <HistoryChart />
      </div>

      <EyeSessions />

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
      </div>
    </main>
  );
}

/** Games played with eye tracking on, newest first. */
function EyeSessions() {
  const data = useLab();
  const rows = data.sessions.filter((s) => s.eye).slice(-8).reverse();
  return (
    <section className="my-4 rounded-card border border-hairline bg-card p-6">
      <h3 className="text-[20px] font-medium">Eye tracking</h3>
      <p className="mt-1 text-[16px] text-muted">
        {rows.length ? "Games played with eye tracking on" : "Turn on Eye tracking on the Games tab, and each game records the eyes."}
      </p>
      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-[15px] tabular-nums">
          <thead className="text-muted">
            <tr className="border-b border-hairline">
              <th className="py-2 pr-4 font-medium">Date</th>
              <th className="py-2 pr-4 font-medium">Game</th>
              <th className="py-2 pr-4 font-medium">Eyes seen</th>
              <th className="py-2 font-medium">Back-and-forth movement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={i} className="border-b border-hairline-soft last:border-0">
                <td className="py-2 pr-4 whitespace-nowrap">{s.date}</td>
                <td className="py-2 pr-4">{s.title}</td>
                <td className="py-2 pr-4">{Math.round(s.eye!.tracked * 100)}% of {s.eye!.seconds} s</td>
                <td className="py-2">{s.eye!.oscHz ? `${s.eye!.oscHz} per second, about ${s.eye!.oscPpDeg}°` : "None stood out"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </section>
  );
}
