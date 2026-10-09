import { GearSix } from "@phosphor-icons/react";
import { openPanel, openTab, useNav, type Tab } from "../lib/nav";
import { sfxProps } from "../lib/sfx";
import { leavePlayer, useLab } from "../lib/lab";
import { PrakashLogo } from "../ui/Logo";
import { Avatar } from "../app/Welcome";

/*
  The bar across the top of Home: the logo, the two tabs (Games, My progress),
  then Settings, Iris as the one navy pill, and the player, whose chip goes
  back to "Who's playing?". It sits inside the filtered stage (the user wants
  the filter on everything). On small screens the tabs get their own row.
*/
export function TopBar() {
  return (
    <header className="relative z-30 shrink-0 border-b border-hairline bg-canvas/95 backdrop-blur-md">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-card">
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-x-6 px-4 sm:px-8">
        <span className="flex shrink-0 items-center gap-4">
          <PrakashLogo height={30} />
          <span aria-hidden className="hidden h-7 w-px bg-hairline-strong lg:block" />
          <span className="hidden text-[19px] font-bold tracking-[-0.01em] lg:block">Eye Lab</span>
        </span>
        <span className="hidden md:block">
          <Tabs />
        </span>
        <nav className="ml-auto flex shrink-0 items-center gap-2" aria-label="Main">
          <button
            {...sfxProps}
            onClick={() => openPanel("settings")}
            aria-label="Settings"
            className="flex h-10 items-center gap-2 rounded-full px-3 text-[15px] font-medium whitespace-nowrap text-body transition-colors duration-200 hover:text-ink"
          >
            <GearSix size={20} weight="light" aria-hidden className="sm:hidden" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button
            {...sfxProps}
            onClick={() => openPanel("iris")}
            className="h-10 rounded-full bg-primary px-5 text-[15px] font-semibold whitespace-nowrap text-card transition-colors duration-200 hover:bg-primary-hover"
          >
            Ask Iris
          </button>
          <PlayerChip />
        </nav>
      </div>
      <div className="flex justify-center border-t border-hairline-soft px-4 py-2 md:hidden">
        <Tabs />
      </div>
    </header>
  );
}

const TABS: [Tab, string][] = [
  ["games", "Games"],
  ["progress", "My progress"],
];

function Tabs() {
  const { tab } = useNav();
  return (
    <div role="tablist" aria-label="Home" className="flex rounded-full bg-strong p-1">
      {TABS.map(([key, name]) => (
        <button
          key={key}
          {...sfxProps}
          role="tab"
          aria-selected={tab === key}
          aria-controls="main"
          onClick={() => openTab(key)}
          className={`h-9 rounded-full px-5 text-[15px] font-semibold whitespace-nowrap transition-colors duration-200 ${
            tab === key ? "bg-card text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted hover:text-ink"
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

function PlayerChip() {
  const name = useLab().settings.name;
  return (
    <button
      {...sfxProps}
      onClick={() => {
        leavePlayer();
        openTab("games");
      }}
      title="Switch player"
      aria-label={`${name} is playing. Switch player`}
      className="flex h-10 items-center gap-2 rounded-full border border-hairline-strong py-1 pr-1 pl-1 transition-colors duration-200 hover:bg-canvas-soft sm:pr-4"
    >
      <Avatar name={name} size={30} />
      <span className="hidden max-w-[10rem] truncate text-[15px] font-medium sm:inline">{name}</span>
    </button>
  );
}
