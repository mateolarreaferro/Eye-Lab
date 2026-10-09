import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Plus } from "@phosphor-icons/react";
import { addPlayer, choosePlayer, usePlayers } from "../lib/lab";
import { sfxProps } from "../lib/sfx";
import { Orb } from "../ui/Orb";
import { PrakashLogo } from "../ui/Logo";

/*
  What opens the app: a short splash (the Project Prakash logo and Eye Lab),
  then "Who's playing?". Every player's progress is kept apart, so one tablet
  can serve a whole clinic. The splash ends by itself or on a tap or key.
*/

const SPLASH_MS = 1800;
/** The splash plays once per visit, not on every switch of player. */
let splashPlayed = false;

export function Welcome() {
  const [splash, setSplash] = useState(!splashPlayed);
  useEffect(() => {
    splashPlayed = true;
  }, []);

  useEffect(() => {
    if (!splash) return;
    const skip = () => setSplash(false);
    const id = window.setTimeout(skip, SPLASH_MS);
    window.addEventListener("keydown", skip);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", skip);
    };
  }, [splash]);

  return (
    <div className="fixed inset-0 isolate z-50 overflow-hidden bg-band text-ink">
      <Orb a="var(--color-orb-1)" b="var(--color-orb-5)" drift className="top-[-25%] left-1/2 -z-10 h-[720px] w-[980px] max-w-none -translate-x-1/2 opacity-80" />
      <AnimatePresence mode="wait">
        {splash ? <Splash key="splash" onDone={() => setSplash(false)} /> : <Picker key="picker" />}
      </AnimatePresence>
    </div>
  );
}

function Splash({ onDone }: { onDone: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onDone}
      aria-label="Eye Lab by Project Prakash. Tap to continue."
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex h-full w-full cursor-default flex-col items-center justify-center gap-8 px-6"
    >
      <motion.span initial={{ y: 10 }} animate={{ y: 0 }} transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}>
        <PrakashLogo height={64} />
      </motion.span>
      <span className="display text-[clamp(3rem,9vw,6rem)]">
        Eye <span className="text-accent">Lab</span>
      </span>
    </motion.button>
  );
}

function Picker() {
  const { list } = usePlayers();
  const sorted = [...list].sort((a, b) => b.lastSeen - a.lastSeen);
  const [adding, setAdding] = useState(list.length === 0);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex h-full flex-col items-center justify-center gap-10 overflow-y-auto px-4 py-10"
    >
      <PrakashLogo height={36} />
      <h1 className="display text-center text-[clamp(2.4rem,6vw,4rem)] text-balance">
        {list.length ? "Who's playing?" : "What's your name?"}
      </h1>
      {list.length > 0 && (
        <ul className="flex max-w-[900px] flex-wrap justify-center gap-4" aria-label="Players">
          {sorted.map((p) => (
            <li key={p.id}>
              <button
                {...sfxProps}
                onClick={() => choosePlayer(p.id)}
                className="group flex w-36 flex-col items-center gap-3 rounded-card bg-card/90 p-5 shadow-soft transition-[background-color,transform] duration-200 hover:bg-card active:scale-[0.98]"
              >
                <Avatar name={p.name} />
                <span className="w-full truncate text-center text-[17px] font-semibold">{p.name}</span>
              </button>
            </li>
          ))}
          {!adding && (
            <li>
              <button
                {...sfxProps}
                onClick={() => setAdding(true)}
                className="flex w-36 flex-col items-center gap-3 rounded-card border border-dashed border-hairline-strong p-5 text-muted transition-colors duration-200 hover:bg-card/60 hover:text-ink"
              >
                <span className="flex size-16 items-center justify-center rounded-full bg-card/70">
                  <Plus size={26} weight="light" aria-hidden />
                </span>
                <span className="text-[17px] font-semibold">New player</span>
              </button>
            </li>
          )}
        </ul>
      )}
      {adding && <NewPlayer onCancel={list.length ? () => setAdding(false) : undefined} />}
    </motion.main>
  );
}

function NewPlayer({ onCancel }: { onCancel?: () => void }) {
  const [name, setName] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const clean = name.trim();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (clean) addPlayer(clean);
      }}
      className="flex w-full max-w-[460px] flex-col items-center gap-3"
    >
      <label htmlFor="player-name" className="sr-only">
        Name
      </label>
      <div className="flex w-full gap-2">
        <input
          ref={ref}
          id="player-name"
          name="player-name"
          autoComplete="off"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Type a name…"
          className="h-14 min-w-0 flex-1 rounded-full border border-hairline-strong bg-card px-6 text-[18px] text-ink outline-none placeholder:text-muted-soft focus-visible:border-ink focus-visible:ring-1 focus-visible:ring-ink"
        />
        <button
          {...sfxProps}
          type="submit"
          disabled={!clean}
          className="flex h-14 shrink-0 items-center gap-2 rounded-full bg-primary px-6 text-[17px] font-semibold text-card transition-[background-color,opacity] duration-200 hover:bg-primary-hover disabled:opacity-40"
        >
          Start
          <ArrowRight size={18} weight="bold" aria-hidden />
        </button>
      </div>
      {onCancel && (
        <button {...sfxProps} type="button" onClick={onCancel} className="text-[15px] font-medium text-muted hover:text-ink">
          Cancel
        </button>
      )}
    </form>
  );
}

/** The player's initial on a round plate. */
export function Avatar({ name, size = 64 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-band font-bold text-accent-deep"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}
