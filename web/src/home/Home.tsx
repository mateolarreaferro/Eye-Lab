import { useEffect, useRef, useState } from "react";
import { ArrowRight, CaretLeft, CaretRight, Clock, Flame, Trophy, type Icon } from "@phosphor-icons/react";
import { GAMES, SECTIONS, type GameDef, type Section } from "../app/catalog";
import { openGame, useNav } from "../lib/nav";
import { filterMinutesOn, resultsFor, streak, today, useLab } from "../lib/lab";
import { sfxProps } from "../lib/sfx";
import { Orb } from "../ui/Orb";
import { IconPlate } from "../ui/IconPlate";
import { WholeScreenCard } from "./WholeScreenRow";

/*
  Home's Games tab, one screen with no vertical scroll: a greeting with the
  day's numbers, the section chips, then every game in one horizontal row,
  centred in the space that is left. The chips jump along the row and show
  where you are; arrows, the arrow keys, a swipe or the mouse wheel move it.
  The filter and eye tracking live in Settings (the gear in the top bar).
*/

export function Home() {
  const data = useLab();
  const minutes = Math.floor(filterMinutesOn(data, today()));
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(SECTIONS[0].key);
  const [edges, setEdges] = useState({ start: true, end: false });

  const groups = () => [...(track.current?.querySelectorAll<HTMLElement>("[data-section]") ?? [])];

  const onScroll = () => {
    const t = track.current;
    if (!t) return;
    setEdges({ start: t.scrollLeft < 8, end: t.scrollLeft + t.clientWidth > t.scrollWidth - 8 });
    // The active section is the last one whose start has passed a third of the row,
    // or the last section once the row is scrolled to its end.
    const mark = t.scrollLeft + t.clientWidth / 3;
    const gs = groups();
    let key = gs[0]?.dataset.section ?? active;
    for (const g of gs) if (g.offsetLeft <= mark) key = g.dataset.section!;
    if (t.scrollLeft + t.clientWidth > t.scrollWidth - 8) key = gs[gs.length - 1]?.dataset.section ?? key;
    setActive(key);
  };

  useEffect(() => {
    onScroll();
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const page = (dir: 1 | -1) => {
    const t = track.current;
    if (t) t.scrollBy({ left: dir * t.clientWidth * 0.75, behavior: "smooth" });
  };

  const jump = (key: string) => {
    const t = track.current;
    const g = groups().find((x) => x.dataset.section === key);
    if (t && g) t.scrollTo({ left: g.offsetLeft, behavior: "smooth" });
  };

  // Arrow keys move the row while nothing else wants them.
  const { panel } = useNav();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (panel || e.altKey || e.metaKey || e.ctrlKey) return;
      if ((e.target as HTMLElement).closest("input, textarea, select, [role=slider], [role=radiogroup], [role=tablist]")) return;
      if (e.key === "ArrowRight") page(1);
      else if (e.key === "ArrowLeft") page(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  });

  // Fade the row's edges only where more cards are hidden.
  const fade = `linear-gradient(to right, ${edges.start ? "#000" : "transparent"}, #000 2.5rem, #000 calc(100% - 2.5rem), ${edges.end ? "#000" : "transparent"})`;

  return (
    <main id="main" role="tabpanel" aria-label="Games" className="relative isolate flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas text-ink">
      <Orb a="var(--color-orb-1)" b="var(--color-orb-5)" drift className="top-[-260px] right-[-120px] -z-10 h-[560px] w-[760px] opacity-60" />

      <div className="mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 flex-col px-4 pt-8 sm:px-8 lg:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h1 className="display text-[clamp(2rem,4vw,3rem)] text-balance">
            Hello, <span className="text-accent">{data.settings.name}</span>.
          </h1>
          <dl className="flex flex-wrap gap-2 pb-1 text-[15px] text-body">
            <Stat icon={Trophy} label="trophies" value={data.stars} />
            <Stat icon={Flame} label={streak(data) === 1 ? "day in a row" : "days in a row"} value={streak(data)} />
            <Stat icon={Clock} label={`of ${data.settings.dailyGoalMin} filter min today`} value={minutes} />
          </dl>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <div className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none]" role="group" aria-label="Sections">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                {...sfxProps}
                onClick={() => jump(s.key)}
                aria-current={active === s.key ? "true" : undefined}
                className={`h-10 shrink-0 rounded-full px-4 text-[15px] font-semibold whitespace-nowrap transition-colors duration-200 ${
                  active === s.key ? "bg-primary text-card" : "bg-strong text-body hover:text-ink"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <div className="hidden shrink-0 gap-2 sm:flex">
            <ArrowButton label="Previous games" disabled={edges.start} onClick={() => page(-1)} icon={CaretLeft} />
            <ArrowButton label="More games" disabled={edges.end} onClick={() => page(1)} icon={CaretRight} />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-center py-6">
          <div
            ref={track}
            onScroll={onScroll}
            onWheel={(e) => {
              // A plain mouse wheel scrolls the row sideways.
              if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) track.current!.scrollLeft += e.deltaY;
            }}
            className="relative flex h-[min(100%,30rem)] min-h-[18rem] snap-x snap-mandatory gap-12 overflow-x-auto overflow-y-hidden [scrollbar-width:none]"
            style={{ maskImage: fade, WebkitMaskImage: fade }}
          >
            {SECTIONS.map((s) => (
              <SectionGroup key={s.key} section={s} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ icon: I, label, value }: { icon: Icon; label: string; value: string | number }) {
  return (
    <div className="flex h-9 items-center gap-2 rounded-full bg-strong px-3.5">
      <I size={18} weight="light" className="text-accent-deep" aria-hidden />
      <dd className="font-bold text-ink tabular-nums">{value}</dd>
      <dt>{label}</dt>
    </div>
  );
}

function ArrowButton({ label, icon: I, onClick, disabled }: { label: string; icon: Icon; onClick: () => void; disabled: boolean }) {
  return (
    <button
      {...sfxProps}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-10 items-center justify-center rounded-full border border-hairline-strong bg-card text-ink transition-[background-color,opacity] duration-200 hover:bg-canvas-soft disabled:opacity-35"
    >
      <I size={18} weight="bold" aria-hidden />
    </button>
  );
}

/** One section's cards; a wider gap than between cards separates sections. */
function SectionGroup({ section }: { section: Section }) {
  const games = GAMES.filter((g) => g.section === section.key);
  return (
    <section
      data-section={section.key}
      aria-label={section.name}
      className="flex h-full shrink-0 snap-start gap-4"
    >
      {games.map((g) => (
        <GameCard key={g.key} game={g} section={section} />
      ))}
      {section.key === "glasses" && (
        <div className="flex h-full w-[min(28rem,80vw)] shrink-0 snap-start">
          <WholeScreenCard />
        </div>
      )}
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
      className="group flex h-full w-[clamp(14rem,22vw,17rem)] shrink-0 snap-start flex-col overflow-hidden rounded-card border border-hairline bg-card text-left transition-[box-shadow,transform] duration-300 hover:shadow-soft active:scale-[0.99]"
    >
      <span className="relative isolate flex min-h-24 flex-1 items-center justify-center overflow-hidden bg-band">
        <Orb a={section.orb} b={section.orb2} className="inset-[-20%] -z-10 opacity-90 transition-transform duration-700 ease-(--ease-calm) group-hover:scale-110" />
        <IconPlate icon={game.icon} size={64} onCard />
        {played && <span className="absolute top-3 right-3 label rounded-full bg-card/80 px-2.5 py-1">Played</span>}
      </span>
      <span className="flex flex-col p-5">
        <span className="text-[19px] font-bold tracking-[-0.01em]">{game.name}</span>
        <span className="mt-1.5 line-clamp-3 min-h-[3lh] text-[15px] leading-relaxed text-body">{game.desc}</span>
        <span className="mt-4 flex items-center gap-1.5 text-[15px] font-semibold text-accent-deep">
          Play
          <ArrowRight size={16} aria-hidden className="transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </span>
    </button>
  );
}
