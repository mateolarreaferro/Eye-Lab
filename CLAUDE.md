# Eye Lab: notes for development

Vision games, tests and spatial-frequency filters for the Sinha lab. Repo: github.com/mateolarreaferro/Eye-Lab.

| Folder | What it is |
|---|---|
| `web/` | **The app.** React + Vite + Tailwind v4 + Motion, served at mateolarreaferro.com/eyelab. |
| `overlay/` | Eye Lab Overlay.app: Swift helper that filters the whole Mac screen (ScreenCaptureKit + Metal). |
| `iris-server/` | Vercel function holding Iris's prompt and tools; calls Claude. |
| `eye_lab/` | The original Godot desktop app, superseded by `web/`. Before touching it or `build_all.sh`, read `docs/godot-desktop.md`. |
| `contrib/vision_quest_vr/` | Samiksha Singh's separate VR project; never built or shipped with Eye Lab. |

## Web app (`web/`)

- Layers in `app/App.tsx`: the **stage** (Home with its top bar, or a game's canvas) sits inside the
  vision filter; the user wants the header filtered too. A game's **chrome** (its floating filter bar,
  Home/trophies/answers/cards) and the side panels sit outside it so they stay readable. A game draws its canvas into the stage through a portal (`exercise/ExerciseShell.tsx`).
- Games extend `exercise/Exercise.ts`, a deliberate mirror of the Godot base class (setup/begin/draw/
  tick/onAnswer/onPointer/onKey/summary; setAnswers/feedback/after/end), so each `exercises/*.ts` stays
  comparable line by line with its `eye_lab/exercises/*.gd` original. Keys in `app/catalog.ts` must match
  Iris's game list in `iris-server/lib/iris.ts`.
- Units: CSS pixels. `pxPerDeg()` assumes 96 px/in until card calibration runs (browsers can't read
  the physical screen size). Blur scale `lod` keeps the desktop meaning (2^lod physical px): convert
  with `devicePixelRatio`, as `sigmaFor` and `lodToCpd` in `lib/filter.ts` do.
- The in-page filter is an SVG filter chain (`filter/FilterDefs.tsx`). SVG clamps every intermediate to
  0..1 and keeps colour at or below alpha, which is why high-pass is built in three steps; read that
  file's comment before changing the math. Only Off, High-pass and Low-pass exist (edges, invert and
  kaleidoscope were removed on purpose).
- Opening: a splash once per visit, then "Who's playing?" (`app/Welcome.tsx`). Each player's progress is
  `eyelab:v1:<id>`, the list `eyelab:players`; distance, calibration and sound are per device
  (`eyelab:device`). The old single `eyelab:v1` migrates to the first player (`lib/lab.ts`). Also
  `eyelab:filter`, `eyelab:iris-key`; the Iris key stays out of the progress data so `get_progress` never sees it.
- Home is one screen tall with no vertical scroll: tabs Games (every game in one horizontal snap row,
  section chips jump along it) and My progress (`progress/ProgressPage.tsx`, scrolls inside the tab).
- The Eye tracking switch on Home records the eyes during any game (`lib/sessionEyes.ts`, wired in
  `ExerciseShell`): camera check on the how-to-play card, a summary per session, a CSV on the result card.
  Games that use the camera themselves are skipped (`OWNS_CAMERA`).
- `?game=<key>` opens a game directly.
- **Eye movement** (`exercises/eyeMovement.ts`) tracks the eyes with MediaPipe Face Landmarker in the browser
  (`lib/eyeTracker.ts`); video never leaves the device, and the runtime and model come from jsDelivr and Google
  storage (pin in `eyeTracker.ts` follows `package.json`). The analysis in `lib/eyeMetrics.ts` is DOM-free so it
  can be checked with synthetic signals; its thresholds are first guesses, not tuned on Prakash data.
  Headless Chromium can feed a face video as the camera (`--use-file-for-fake-video-capture=face.y4m`).
- **Effects take block bodies** (`useEffect(() => { ... })`). React treats any returned value as the
  cleanup, and newer Chrome (154+) returns a Promise from `scrollIntoView`/`scrollTo`, so a one-line
  `useEffect(() => el.scrollIntoView())` crashed the whole page on its next re-run (fixed 2026-10-08).
  `ui/ErrorBoundary.tsx` keeps any future crash from blanking the page.
- Check visually with Playwright, not the Chrome extension: the extension's tab reports
  `visibilityState: hidden`, which pauses animation frames and freezes Motion mid-slide. Use
  `playwright-core` from `~/Desktop/repos/MLF-Web/node_modules` with the headless shell in
  `~/Library/Caches/ms-playwright/chromium_headless_shell-1217/`.
- Deploy: MLF-Web's `npm run sync:demos -- eyelab` builds `hosted/Eye-Lab/web` with `--base=/eyelab/`
  into its `public/eyelab/` (committed there); `next.config.ts` rewrites `/eyelab`. Never edit that copy.

## Look (web)

Project Prakash's look (projectprakash.org, chosen 2026-10-08) on the clean ElevenLabs-style structure
the user approved before it: white and pale sky-blue bands (`--color-band`), deep navy ink `#161c32`, sky
blue `#55c1f2` for highlighted words and labels, navy pill buttons, white cards with 1px hairlines and one
soft shadow tier, and soft blue blooms (`ui/Orb.tsx`) as the only atmosphere. The Project Prakash logo
(`src/assets/project-prakash-logo.svg`, a cleaned copy of their header SVG; the user asked to use it)
leads the top bar and footer. **One typeface everywhere: Figtree** (the face their headings use): body
400/500, titles 600-700, `.label` for small uppercase sky-blue labels. That includes canvas text in the
games (`"Figtree Variable"`). Icons are Phosphor `light` on round plates (`ui/IconPlate.tsx`). Tokens
live in `src/index.css`; use them, not raw hex. Rejected along the way: a split hero with accordion
bars, flat saturated blocks, soft tinted cards. **Navigation comes first**: every game is one click from
Home, every control is labelled, and each call to action appears once. Sounds (`lib/sfx.ts`) are short
synthesised sine ticks; **never noise** (the user hated it).

## Whole-screen helper (`overlay/`)

- The page reaches the helper two ways (`web/src/lib/helper.ts`): the `eyelab-overlay://on?mode=..`
  link launches it, then a local server on `127.0.0.1:47823` answers `GET /status` and `POST /state`
  (`{mode, lod, gain, keep, mix}`, mode 0 quits). The server is bound to loopback, rejects other Host
  headers (DNS rebinding) and grants CORS only to mateolarreaferro.com and http://localhost origins.
- Newer Chrome asks visitors for local-network access on the first 127.0.0.1 request, so the page
  contacts the helper only after someone turns Whole screen on (remembered in localStorage).
- Launched without `--state` (from the web or by hand) it keeps state in
  `~/Library/Application Support/Eye Lab Overlay/`; the desktop app passes `--state`.
- **Permission trap**: Screen Recording permission is tied to the exact ad-hoc signed build, and any
  rebuild silently revokes it. Change the helper only when necessary and tell the user to re-allow it.
  `overlay/build.sh` skips unchanged sources (`--force` overrides).
- Test without a permission prompt: `"build/Eye Lab Overlay.app/Contents/MacOS/EyeLabOverlay" --no-capture`,
  then curl the server. `--selftest` checks the GPU pipeline and permission.
- Protected video (Safari, Netflix app) captures as black; Chrome/Firefox work.
- Releases carry `Eye Lab Overlay.zip` (`ditto -c -k --keepParent`); the page links to
  `releases/latest/download/Eye.Lab.Overlay.zip` (GitHub turns the spaces into dots).

## Iris (`iris-server/`)

- Prompt, tool schemas and model live **only on the server** (`lib/iris.ts`); clients send
  `{messages}` and run the tools themselves (`web/src/lib/iris.ts`).
- The web app sends the visitor's own key as `x-anthropic-key`; the server uses it for that call only.
  The shared `x-eyelab-key` path (Vercel env `EYELAB_APP_KEY`, server key `ANTHROPIC_API_KEY`) is for old
  desktop builds. CORS in `api/iris.ts` allows the site and localhost.
- Model `claude-opus-5`, effort `low`, `fallbacks: "default"` with beta `server-side-fallback-2026-07-01`.
  Deploy: `cd iris-server && vercel deploy --prod` (project `eye-lab-iris`).
- Iris stays on-topic (app, games, filters, research, the player's progress), never diagnoses or
  promises results, and writes plain text with no emoji.

## Before pushing

`git grep --cached -nE "sk-ant-[A-Za-z0-9_-]{20,}"` and the app key must find nothing; PDFs stay ignored.
