import { ArrowRight, Clock, Flame, Trophy, type Icon } from "@phosphor-icons/react";
import { GAMES, SECTIONS, gameByKey, type GameDef, type Section } from "../app/catalog";
import { openGame } from "../lib/nav";
import { filterMinutesOn, resultsFor, streak, today, useLab } from "../lib/lab";
import { sfxProps } from "../lib/sfx";
import { Orb } from "../ui/Orb";
import { IconPlate } from "../ui/IconPlate";
import { WholeScreenCard } from "./WholeScreenRow";
import { PrakashLogo } from "../ui/Logo";

/*
  Home: a quiet editorial hero over a drifting pastel orb, then every game as a
  white card grouped by section. The top bar (TopBar.tsx, outside the filter)
  holds the filter and the links to Progress, Settings and Iris.
*/

export function Home() {
  const data = useLab();
  const name = data.settings.name.trim();
  const minutes = Math.floor(filterMinutesOn(data, today()));

  return (
    <main id="main" className="min-h-dvh bg-canvas text-ink">
      <section className="relative isolate overflow-hidden bg-band">
        <Orb a="var(--color-orb-1)" b="var(--color-orb-5)" drift className="top-[-30%] right-[-10%] -z-10 h-[680px] w-[760px] opacity-80" />
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.25fr_1fr] lg:px-12 lg:py-24">
          <div>
            <h1 className="display text-[clamp(2.6rem,5.5vw,4.25rem)]">
              {name ? (
                <>
                  Hello, <span className="text-accent">{name}</span>.
                </>
              ) : (
                <>
                  See <span className="text-accent">less</span>.
                  <br />
                  Perceive <span className="text-accent">more</span>.
                </>
              )}
            </h1>
            <div className="mt-9 flex flex-wrap gap-3">
              <PillButton primary onClick={() => openGame(gameByKey("acuity")!)}>
                Start with the eye check-up
              </PillButton>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3 lg:grid-cols-1">
            <Stat icon={Trophy} label="Trophies" value={data.stars} />
            <Stat icon={Flame} label="Days in a row" value={streak(data)} />
            <Stat icon={Clock} label="Filter minutes today" value={`${minutes} of ${data.settings.dailyGoalMin}`} />
          </dl>
        </div>
      </section>

      <div id="games" className="mx-auto flex max-w-[1200px] scroll-mt-24 flex-col gap-20 px-5 py-20 sm:px-8 lg:px-12">
        {SECTIONS.map((s) => (
          <SectionBlock key={s.key} section={s} />
        ))}
      </div>

      <footer className="border-t border-hairline bg-canvas-soft">
        <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8 lg:px-12">
          <PrakashLogo height={28} />
        </div>
      </footer>
    </main>
  );
}

export function PillButton({ children, onClick, primary = false }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      {...sfxProps}
      onClick={onClick}
      className={`flex h-12 items-center gap-2 rounded-full px-6 text-[16px] font-semibold transition-colors duration-200 ${
        primary ? "bg-primary text-card hover:bg-primary-hover" : "bg-card text-ink shadow-soft hover:bg-canvas-soft"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ icon: I, label, value }: { icon: Icon; label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-card bg-card/90 p-4 shadow-soft lg:flex-row lg:items-center lg:gap-4 lg:px-5">
      <I size={26} weight="light" className="text-accent-deep" aria-hidden />
      <dd className="text-[26px] font-bold tracking-[-0.02em] tabular-nums lg:order-last lg:ml-auto">{value}</dd>
      <dt className="text-[14px] leading-tight text-muted lg:text-[16px]">{label}</dt>
    </div>
  );
}

function SectionBlock({ section }: { section: Section }) {
  const games = GAMES.filter((g) => g.section === section.key);
  return (
    <section aria-labelledby={`sec-${section.key}`}>
      <h2 id={`sec-${section.key}`} className="display mb-8 text-[34px]">
        {section.name}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => (
          <GameCard key={g.key} game={g} section={section} />
        ))}
        {section.key === "glasses" && <WholeScreenCard />}
      </div>
    </section>
  );
}

function GameCard({ game, section }: { game: GameDef; section: Section }) {
  const data = useLab();
  const played = data.sessions.some((s) => s.id === game.key) || resultsFor(data, game.key).length > 0;
  return (
    <button
      {...sfxProps}
      onClick={() => openGame(game)}
      className="group flex flex-col overflow-hidden rounded-card border border-hairline bg-card text-left transition-shadow duration-300 hover:shadow-soft"
    >
      <span className="relative isolate flex h-36 items-center justify-center overflow-hidden bg-band">
        <Orb a={section.orb} b={section.orb2} className="inset-[-20%] -z-10 opacity-90 transition-transform duration-700 ease-(--ease-calm) group-hover:scale-110" />
        <IconPlate icon={game.icon} size={56} onCard />
        {played && <span className="absolute top-3 right-3 label rounded-full bg-card/80 px-2.5 py-1">Played</span>}
      </span>
      <span className="flex flex-1 flex-col p-5">
        <span className="text-[19px] font-bold tracking-[-0.01em]">{game.name}</span>
        <span className="mt-1.5 flex-1 text-[15px] leading-relaxed text-body">{game.desc}</span>
        <span className="mt-5 flex items-center gap-1.5 text-[15px] font-semibold text-accent-deep">
          Play
          <ArrowRight size={16} aria-hidden className="transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </span>
    </button>
  );
}
