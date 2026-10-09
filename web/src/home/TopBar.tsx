import { openPanel } from "../lib/nav";
import { sfxProps } from "../lib/sfx";
import { CutoffSlider, FilterModes } from "../filter/FilterBar";
import { useFilter } from "../lib/filter";
import { PrakashLogo } from "../ui/Logo";

/*
  The bar across the top of Home: the logo, the filter, text links to
  Progress and Settings, and Iris as the one navy pill. It sits inside the
  filtered stage (the user wants the filter on everything), and the cutoff
  slider gets its own slim row under the bar while a filter is on, so the
  main row never wraps.
*/
export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/95 backdrop-blur-md">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-card">
        Skip to games
      </a>
      <div className="mx-auto flex min-h-16 max-w-[1200px] items-center gap-x-6 px-5 py-3 sm:px-8 lg:px-12">
        <span className="flex shrink-0 items-center gap-4">
          <PrakashLogo height={30} />
          <span aria-hidden className="hidden h-7 w-px bg-hairline-strong sm:block" />
          <span className="hidden text-[19px] font-bold tracking-[-0.01em] sm:block">Eye Lab</span>
        </span>
        <span className="hidden md:block">
          <FilterModes />
        </span>
        <nav className="ml-auto flex shrink-0 items-center gap-1" aria-label="Main">
          <NavLink onClick={() => openPanel("progress")}>Progress</NavLink>
          <NavLink onClick={() => openPanel("settings")}>Settings</NavLink>
          <button
            {...sfxProps}
            onClick={() => openPanel("iris")}
            className="ml-2 h-10 rounded-full bg-primary px-5 text-[15px] font-semibold whitespace-nowrap text-card transition-colors duration-200 hover:bg-primary-hover"
          >
            Ask Iris
          </button>
        </nav>
      </div>
      {/* Small screens get the modes on their own row; the cutoff sits under the bar while a filter is on. */}
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-5 empty:hidden sm:px-8 md:hidden">
        <FilterModes />
      </div>
      <SliderRow />
    </header>
  );
}

function SliderRow() {
  const { mode } = useFilter();
  if (mode === 0) return null;
  return (
    <div className="border-t border-hairline-soft">
      <div className="mx-auto flex max-w-[1200px] px-5 py-2 sm:px-8 lg:px-12">
        <CutoffSlider width="w-40" />
      </div>
    </div>
  );
}

function NavLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button {...sfxProps} onClick={onClick} className="h-10 rounded-full px-3.5 text-[15px] font-medium whitespace-nowrap text-body transition-colors duration-200 hover:text-ink">
      {children}
    </button>
  );
}
