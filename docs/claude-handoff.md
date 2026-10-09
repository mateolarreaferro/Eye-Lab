# Eye Lab handoff

Newest entry first. Read with `git log` at session start.

# Iris: bottom-right button, context block, data tools and charts (2026-10-09)

## Where we are - `main` at `c6ab369` plus uncommitted changes, no test suite, web and server typecheck and build pass
- Ask Iris left the top bar; it is a navy pill fixed at the bottom right of Home
  (`web/src/iris/AskIris.tsx`, rendered from `App.tsx` outside the filtered stage, Home only).
- Iris server (`iris-server/lib/iris.ts`): prompt rewritten in sections (scope and safety, how to
  talk and teach, when to use tools, how to read the data honestly, challenges, app map, per-game
  meaning of each number, research). Tools now: open_game, open_page (home, progress, Settings
  tabs, calibrate), set_filter, set_filter_params, set_whole_screen, set_setting, get_progress
  (optional game key), show_chart, export_data. `api/iris.ts` accepts `{messages, context}` and
  appends the context as a second system block after the cached prompt.
- Web client (`web/src/lib/iris.ts`): sends a "Right now" context with every request (date, player,
  screen, filter and sliders, settings, today's numbers) and runs the new tools against the stores.
  Bubbles are now `{kind: "text"}` or `{kind: "chart"}`; `iris/ChatChart.tsx` draws the chart.
- `web/src/lib/report.ts` (new, DOM-free): per-game trends (first, latest, best, change, improved,
  days since last, history with compact detail, eye trace stripped), badges (ProgressPage now
  reads the same list), chart series, CSV exports. `LabData` is exported from `lab.ts` for it.
- Verified: `tsc -b` and `vite build` in `web/`, `tsc --noEmit` in `iris-server/`. End to end in
  headless Chromium with a mock Iris server replaying a five-step tool script (get_progress,
  two show_chart calls, set_setting plus set_filter, final text): charts rendered in the chat,
  settings and filter changed, context block updated between rounds, no page errors. Screenshots
  of Home, the chat and the filtered Home afterwards looked right. Not verified: a real Claude
  call with the new prompt and tools (no key used in this session).

## What is next
1. Commit the working tree, then deploy the server: `cd iris-server && vercel deploy --prod`.
   Until the server is deployed, the live site only has the old five tools and ignores `context`.
2. Try real conversations with a key: "How am I doing?", "Give me a challenge", "Test my left
   eye with Letter E", "Why would High-pass help?", a researcher asking for the CSV. Tune the
   prompt's wobble bands and challenge rules in `iris-server/lib/iris.ts` from what you see.
3. Deploy the web app through MLF-Web (`npm run sync:demos -- eyelab`).

## Open items / questions
- Effort stays `low` on the server call (CLAUDE.md decision). If the science answers feel thin,
  `medium` is the lever in `iris-server/api/iris.ts`.
- Old Godot desktop builds share the endpoint; they answer the new tools with "Unknown tool",
  and the prompt now describes the web app. Fine while the desktop app stays superseded.
- Ask Iris is hidden during a game (it would sit over answer buttons). Decide whether a smaller
  icon-only version should show in games.
