import { useEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowCounterClockwise, Check, House, Info, Play, Trophy } from "@phosphor-icons/react";
import type { AnswerOption, Exercise, Summary } from "./Exercise";
import { type GameDef, SECTION_HEX, sectionOf } from "../app/catalog";
import { goHome, openGame } from "../lib/nav";
import { logResult, recordSession } from "../lib/lab";
import { play, sfxProps } from "../lib/sfx";
import { IconPlate } from "../ui/IconPlate";
import { Orb } from "../ui/Orb";

/*
  Runs one game: loads its module, shows the how-to-play card, then drives the
  canvas (tick + draw every frame) inside the filtered stage, and draws the
  chrome (Home, trophies, status, answers, result card) outside it.
*/

type Phase = "loading" | "intro" | "playing" | "result";

export function ExerciseShell({ game, stage }: { game: GameDef; stage: HTMLElement }) {
  const [ex, setEx] = useState<Exercise | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [result, setResult] = useState<Summary | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load and set up the game.
  useEffect(() => {
    let alive = true;
    let inst: Exercise | null = null;
    game.load().then((mod) => {
      if (!alive) return;
      inst = new mod.default();
      inst.config = game.config ?? {};
      inst.accent = SECTION_HEX[game.section];
      inst.width = window.innerWidth;
      inst.height = window.innerHeight;
      inst.setup();
      inst.subscribe(bump);
      inst.onEnd = () => finish(inst!);
      setEx(inst);
      setPhase("intro");
    });
    return () => {
      alive = false;
      inst?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  function finish(inst: Exercise) {
    const s = inst.summary();
    if (inst.started && inst.id !== "calibrate") recordSession(inst.id, inst.title, inst.trophies);
    if (s && s.value !== undefined) logResult(inst.id, inst.title, s.value, s.unit ?? "", s.detail ?? {});
    if (s?.text) {
      play("complete");
      setResult(s);
      setPhase("result");
    } else {
      goHome();
    }
  }

  function start() {
    if (!ex || ex.started) return;
    ex.started = true;
    setPhase("playing");
    ex.begin();
    bump();
  }

  // Frame loop and canvas sizing.
  useEffect(() => {
    if (!ex) return;
    const canvas = canvasRef.current!;
    const g = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      ex.width = window.innerWidth;
      ex.height = window.innerHeight;
      canvas.width = Math.round(ex.width * dpr);
      canvas.height = Math.round(ex.height * dpr);
      canvas.style.width = `${ex.width}px`;
      canvas.style.height = `${ex.height}px`;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (ex.started && !ex.ended) {
        ex.time += dt;
        ex.tick(dt);
      }
      if (ex.flashT > 0) ex.flashT = Math.max(0, ex.flashT - dt);
      g.save();
      ex.draw(g);
      g.restore();
      if (ex.flashT > 0) {
        g.fillStyle = `rgba(${ex.flashColor}, ${(0.16 * ex.flashT) / 0.25})`;
        g.fillRect(0, 0, ex.width, ex.height);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [ex]);

  // Keyboard: Esc leaves, Enter/Space starts, everything else goes to the game.
  useEffect(() => {
    if (!ex) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select")) return;
      // A focused button handles its own Enter/Space (Back, Play again).
      if ((e.key === "Enter" || e.key === " ") && t.closest("button, a")) return;
      if (phase === "result") {
        if (["Escape", "Enter", " "].includes(e.key)) {
          e.preventDefault();
          goHome();
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (ex.started) ex.end();
        else goHome();
        return;
      }
      if (!ex.started) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          start();
        }
        return;
      }
      if (ex.onKey(e)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pointer = (type: "down" | "move" | "up") => (e: React.PointerEvent) => {
    if (!ex || !ex.started || ex.ended) return;
    ex.onPointer({ type, x: e.clientX, y: e.clientY });
  };

  return (
    <>
      {createPortal(
        <canvas
          ref={canvasRef}
          aria-hidden
          className="fixed inset-0 block touch-none"
          onPointerDown={pointer("down")}
          onPointerMove={pointer("move")}
          onPointerUp={pointer("up")}
        />,
        stage,
      )}

      {ex && phase === "playing" && (
        <>
          <button
            {...sfxProps}
            onClick={() => ex.end()}
            className="fixed top-4 left-4 z-30 flex h-11 items-center gap-2 rounded-full border border-hairline bg-card pr-5 pl-4 text-[15px] font-medium text-ink shadow-soft transition-colors duration-200 hover:bg-canvas"
            title="Stop and go back home (Esc)"
          >
            <House size={20} weight="light" aria-hidden />
            Home
          </button>
          <div
            className="fixed top-4 right-4 z-30 flex h-11 items-center gap-2 rounded-full border border-hairline bg-card px-5 text-[17px] font-medium text-ink shadow-soft tabular-nums"
            title="Correct answers this round"
            aria-live="polite"
            aria-label={`${ex.trophies} trophies`}
          >
            <Trophy size={20} weight="light" aria-hidden />
            {ex.trophies}
          </div>
          {ex.status && (
            <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-4 z-30 max-w-[60vw] rounded-full bg-card/90 px-4 py-2 text-[14px] text-body tabular-nums">
              {ex.status}
            </div>
          )}
          {ex.answers.length > 0 && (
            <div className="fixed inset-x-0 bottom-6 z-30 flex flex-wrap justify-center gap-3 px-4">
              {ex.answers.map((o) => (
                <AnswerButton
                  key={String(o.id)}
                  option={o}
                  size={ex.answerSize}
                  disabled={!ex.answersEnabled}
                  onPick={() => ex.started && !ex.ended && ex.onAnswer(o.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {ex && phase === "intro" && (
          <Card key="intro" game={game} title={ex.title}>
            <ol className="divide-y divide-hairline border-y border-hairline">
              {ex.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-4 py-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-strong text-[14px] font-medium tabular-nums">{i + 1}</span>
                  <span className="pt-0.5 text-[17px] leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
            {ex.instructions && (
              <p className="mt-5 flex gap-3 text-[15px] leading-relaxed text-muted">
                <Info size={20} weight="light" className="mt-0.5 shrink-0" aria-hidden />
                {ex.instructions}
              </p>
            )}
            <Actions>
              <GhostButton onClick={goHome} icon={<ArrowLeft size={20} weight="bold" aria-hidden />}>
                Back
              </GhostButton>
              <PrimaryButton onClick={start} icon={<Play size={20} weight="fill" aria-hidden />}>
                Start
              </PrimaryButton>
            </Actions>
          </Card>
        )}
        {ex && phase === "result" && result && (
          <Card key="result" game={game} title={ex.title}>
            {ex.id !== "calibrate" && (
              <p className="mb-5 flex items-center gap-3 text-[20px] font-medium">
                <Trophy size={26} weight="light" aria-hidden />
                {ex.trophies} {ex.trophies === 1 ? "trophy" : "trophies"}
              </p>
            )}
            <p className="border-t border-hairline pt-5 text-[17px] leading-relaxed whitespace-pre-line text-body">{result.text}</p>
            <Actions>
              {ex.id !== "calibrate" && (
                <GhostButton onClick={() => openGame(game)} icon={<ArrowCounterClockwise size={20} weight="bold" aria-hidden />}>
                  Play again
                </GhostButton>
              )}
              <PrimaryButton onClick={goHome} icon={<Check size={20} weight="bold" aria-hidden />}>
                Done
              </PrimaryButton>
            </Actions>
          </Card>
        )}
      </AnimatePresence>
    </>
  );
}

/** A quiet full-screen page: a soft orb in the section's colours behind the
 * game's icon, the title, then the content.
 * Fades in; nothing slides across the screen. */
function Card({ game, title, children }: { game: GameDef; title: string; children: React.ReactNode }) {
  const section = sectionOf(game);
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="fixed inset-0 isolate z-40 overflow-y-auto bg-canvas"
    >
      <Orb a={section.orb} b={section.orb2} drift className="top-[-120px] left-1/2 -z-10 h-[420px] w-[760px] max-w-none -translate-x-1/2 opacity-70" />
      <motion.div
        initial={{ y: 8 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto flex min-h-full max-w-[640px] flex-col justify-center px-6 py-14"
      >
        <div className="flex flex-col items-center text-center">
          <IconPlate icon={game.icon} size={72} onCard />
          <h1 className="display mt-8 mb-10 text-[clamp(2.5rem,6vw,3.75rem)] text-balance">{title}</h1>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-10 flex flex-wrap justify-center gap-3">{children}</div>;
}

export function PrimaryButton({ children, onClick, icon }: { children: React.ReactNode; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button
      {...sfxProps}
      autoFocus
      onClick={onClick}
      className="flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-[16px] font-medium text-card transition-colors duration-200 hover:bg-primary-hover"
    >
      {icon}
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, icon }: { children: React.ReactNode; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button
      {...sfxProps}
      onClick={onClick}
      className="flex h-12 items-center gap-2 rounded-full border border-hairline-strong px-6 text-[16px] font-medium text-ink transition-colors duration-200 hover:bg-card"
    >
      {icon}
      {children}
    </button>
  );
}

function AnswerButton({
  option,
  size,
  disabled,
  onPick,
}: {
  option: AnswerOption;
  size: { w: number; h: number };
  disabled: boolean;
  onPick: () => void;
}) {
  const Icon = option.icon;
  return (
    <button
      {...sfxProps}
      disabled={disabled}
      title={option.tip}
      aria-label={option.text || option.tip}
      onClick={onPick}
      className="flex flex-col items-center justify-center gap-2 rounded-card border border-hairline bg-card px-4 text-[15px] font-medium text-ink shadow-soft transition-[opacity,background-color] duration-200 hover:bg-canvas-soft disabled:opacity-45"
      style={{ minWidth: Math.max(size.w, 108), height: Math.max(size.h, 100) }}
    >
      {option.glyph ? <Glyph draw={option.glyph} /> : Icon ? <Icon size={36} weight="light" /> : null}
      {option.text}
    </button>
  );
}

function Glyph({ draw }: { draw: NonNullable<AnswerOption["glyph"]> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.height = 44 * dpr;
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, 44, 44);
    draw(g, 44, "#0c0a09");
  }, [draw]);
  return <canvas ref={ref} aria-hidden style={{ width: 44, height: 44 }} />;
}
