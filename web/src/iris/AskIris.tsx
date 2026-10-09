import { motion } from "motion/react";
import { ChatCircleText } from "@phosphor-icons/react";
import { openPanel } from "../lib/nav";
import { sfxProps } from "../lib/sfx";

/** The one way to reach Iris on Home: a navy pill floating at the bottom right,
 * outside the filtered stage so it always reads (moved there on 2026-10-09). */
export function AskIris() {
  return (
    <motion.button
      {...sfxProps}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      onClick={() => openPanel("iris")}
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex h-12 items-center gap-2 rounded-full bg-primary pr-5 pl-4 text-[15px] font-semibold whitespace-nowrap text-card shadow-soft transition-[background-color,transform] duration-200 hover:bg-primary-hover active:scale-[0.98] sm:right-8 sm:bottom-8"
    >
      <ChatCircleText size={22} weight="light" aria-hidden />
      Ask Iris
    </motion.button>
  );
}
