import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { PaperPlaneRight, ArrowCounterClockwise, Key } from "@phosphor-icons/react";
import { Sheet } from "../ui/Sheet";
import { ask, iris, keySource, resetChat } from "../lib/iris";
import { openPanel } from "../lib/nav";
import { useLab } from "../lib/lab";
import { sfxProps } from "../lib/sfx";

const SUGGESTIONS = [
  "What does the High-pass filter do?",
  "Start the Letter E test",
  "How am I doing?",
  "What's the science behind Dot hunt?",
];

/** Chat with Iris, in the lilac of her home-screen bar. */
export function IrisPanel() {
  const { bubbles, busy } = iris.use();
  const { settings } = useLab();
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const name = settings.name.trim();

  const reduce = useReducedMotion();
  useEffect(() => end.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" }), [bubbles.length, busy, reduce]);

  const submit = (q: string) => {
    if (!q.trim() || busy) return;
    setText("");
    void ask(q);
  };

  return (
    <Sheet title="Ask Iris" orb={["var(--color-orb-3)", "var(--color-orb-5)"]}>
      <div className="flex min-h-full flex-col">
        <div role="log" aria-live="polite" className="flex flex-1 flex-col gap-3 pb-4">
          <Bubble mine={false}>
            {`Hi${name ? `, ${name}` : ""}! I'm Iris. Ask me about any game, the filters, or the science behind Eye Lab. I can also start games and switch filters for you.`}
          </Bubble>
          {keySource() === "none" && (
            <div className="flex items-start gap-3 rounded-card border border-hairline bg-card p-4 text-[16px] leading-relaxed">
              <Key size={24} weight="light" className="mt-0.5 shrink-0 text-muted" aria-hidden />
              <span>
                I need a Claude API key before I can answer.{" "}
                <button {...sfxProps} onClick={() => openPanel("settings", "iris")} className="font-medium underline underline-offset-4">
                  Add one in Settings
                </button>
                .
              </span>
            </div>
          )}
          {bubbles.map((b, i) => (
            <Bubble key={i} mine={b.mine}>
              {b.text}
            </Bubble>
          ))}
          {busy && (
            <div role="status" className="flex gap-1.5 self-start rounded-card bg-canvas px-5 py-4" aria-label="Iris is thinking">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-2.5 animate-pulse rounded-full bg-muted-soft" style={{ animationDelay: `${i * 160}ms` }} />
              ))}
            </div>
          )}
          <div ref={end} />
        </div>

        {bubbles.length === 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                {...sfxProps}
                onClick={() => submit(s)}
                className="rounded-full border border-hairline-strong px-4 py-2 text-[14px] font-medium transition-colors duration-200 hover:bg-card"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(text);
          }}
          className="sticky bottom-0 flex items-center gap-2 bg-canvas pt-3"
        >
          <label className="sr-only" htmlFor="iris-input">
            Message
          </label>
          <input
            id="iris-input"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            name="message"
            autoComplete="off"
            placeholder="Ask about Eye Lab…"
            autoFocus={window.matchMedia("(pointer: fine)").matches}
            className="h-14 min-w-0 flex-1 rounded-full bg-canvas px-5 text-[17px] text-ink border border-hairline-strong outline-none placeholder:text-muted-soft focus-visible:border-ink focus-visible:ring-1 focus-visible:ring-ink"
          />
          <button
            {...sfxProps}
            type="submit"
            disabled={busy || !text.trim()}
            aria-label="Send"
            className="flex size-14 items-center justify-center rounded-full bg-primary text-card transition-opacity duration-300 disabled:opacity-30"
          >
            <PaperPlaneRight size={20} weight="fill" />
          </button>
          {bubbles.length > 0 && (
            <button
              {...sfxProps}
              type="button"
              onClick={resetChat}
              aria-label="New chat"
              title="New chat"
              className="flex size-14 items-center justify-center rounded-full bg-canvas border border-hairline-strong"
            >
              <ArrowCounterClockwise size={18} weight="bold" />
            </button>
          )}
        </form>
      </div>
    </Sheet>
  );
}

function Bubble({ mine, children }: { mine: boolean; children: React.ReactNode }) {
  return (
    <p
      className={`max-w-[85%] rounded-card px-5 py-3.5 text-[16px] leading-relaxed break-words whitespace-pre-line ${
        mine ? "self-end bg-primary text-card" : "self-start border border-hairline bg-card text-ink"
      }`}
    >
      {children}
    </p>
  );
}
