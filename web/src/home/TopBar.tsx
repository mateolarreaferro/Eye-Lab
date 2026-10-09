import { openPanel } from "../lib/nav";
import { sfxProps } from "../lib/sfx";
import { FilterControl } from "../filter/FilterBar";
import { PrakashLogo } from "../ui/Logo";

/*
  The bar across the top of Home: the wordmark, the filter, text links to
  Progress and Settings, and Iris as the one ink pill. It sits outside the
  filtered stage, so it always stays readable.
*/
export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/95 backdrop-blur-md">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-card">
        Skip to games
      </a>
      <div className="mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3 sm:px-8 lg:px-12">
        <span className="flex items-center gap-4">
          <PrakashLogo height={30} />
          <span aria-hidden className="h-7 w-px bg-hairline-strong" />
          <span className="text-[19px] font-bold tracking-[-0.01em]">Eye Lab</span>
        </span>
        <FilterControl />
        <nav className="ml-auto flex items-center gap-1" aria-label="Main">
          <NavLink onClick={() => openPanel("progress")}>Progress</NavLink>
          <NavLink onClick={() => openPanel("settings")}>Settings</NavLink>
          <button
            {...sfxProps}
            onClick={() => openPanel("iris")}
            className="ml-2 h-10 rounded-full bg-primary px-5 text-[15px] font-semibold text-card transition-colors duration-200 hover:bg-primary-hover"
          >
            Ask Iris
          </button>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button {...sfxProps} onClick={onClick} className="h-10 rounded-full px-3.5 text-[15px] font-medium text-body transition-colors duration-200 hover:text-ink">
      {children}
    </button>
  );
}
