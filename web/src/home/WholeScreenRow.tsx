import { DownloadSimple, Monitor } from "@phosphor-icons/react";
import { useFilter } from "../lib/filter";
import { DOWNLOAD_URL, setWholeScreen, useHelper } from "../lib/helper";
import { sfxProps } from "../lib/sfx";
import { Switch } from "../ui/Switch";
import { IconPlate } from "../ui/IconPlate";
import { Orb } from "../ui/Orb";

/** The Whole screen card in Magic glasses: a switch for the macOS helper, with
 * what to do when it isn't installed or isn't allowed yet. It closes the
 * games row; the install steps scroll inside it when tall. */
export function WholeScreenCard() {
  const { wholeScreen } = useFilter();
  const { status, error } = useHelper();

  let note = "Puts the filter on your whole Mac, even other apps and videos. Needs a small free helper app.";
  if (status === "launching") note = "Opening the helper. If your browser asks, allow it to open Eye Lab Overlay.";
  if (status === "running" && wholeScreen) note = "On. Turn it off here or from the eye icon in the menu bar.";
  if (status === "no-permission") {
    note = "macOS hasn't allowed the helper to see the screen yet. Turn it on in System Settings, Privacy & Security, Screen & System Audio Recording.";
  }
  if (error) note = error;

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-card border border-hairline bg-card">
      <div className="relative isolate flex h-36 shrink-0 items-center justify-between overflow-hidden bg-band px-6">
        <Orb a="var(--color-orb-3)" b="var(--color-orb-4)" className="inset-[-20%] -z-10 opacity-90" />
        <IconPlate icon={Monitor} size={56} onCard />
        <label className="flex items-center gap-3 rounded-full bg-card/80 py-1.5 pr-1.5 pl-4 text-[14px] font-medium backdrop-blur-sm">
          {wholeScreen ? "On" : "Off"}
          <Switch on={wholeScreen} onChange={(on) => void setWholeScreen(on)} label="Whole screen filter" />
        </label>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
        <span className="text-[19px] font-bold tracking-[-0.01em]">Whole screen</span>
        <span aria-live="polite" className="mt-1.5 max-w-[60ch] text-[15px] leading-relaxed text-body">
          {note}
        </span>
        {(status === "absent" || error) && (
          <div className="mt-5 flex flex-col gap-4 border-t border-hairline pt-5 lg:flex-row lg:items-start lg:gap-8">
            <a
              {...sfxProps}
              href={DOWNLOAD_URL}
              className="flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-primary px-5 text-[15px] font-medium text-card transition-colors duration-200 hover:bg-primary-hover"
            >
              <DownloadSimple size={18} aria-hidden />
              Get the helper for macOS
            </a>
            <ol className="list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-body">
              <li>Unzip it and move Eye Lab Overlay to Applications.</li>
              <li>Open it once. If macOS blocks it, choose Open Anyway in System Settings, Privacy & Security.</li>
              <li>Allow it under Screen & System Audio Recording, then switch Whole screen on here.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
