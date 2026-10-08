# Eye Lab: notes for development

macOS vision-training app. Godot 4.7 project (`eye_lab/`), a Swift whole-screen filter helper
(`overlay/`), and a Vercel function that proxies Claude for the Iris chat (`iris-server/`).
`contrib/vision_quest_vr/` is Samiksha Singh's separate VR project; it is not built or shipped with Eye Lab.
Repo: github.com/mateolarreaferro/Eye-Lab. Releases carry `Eye Lab.zip` built by `build_all.sh`.

## Build, run, test

- Godot binary: `~/Desktop/Godot.app/Contents/MacOS/Godot` (4.7.2; macOS export templates installed).
- Full build: `./build_all.sh` → `build/Eye Lab.app`. Then zip with
  `cd build && ditto -c -k --keepParent "Eye Lab.app" "Eye Lab.zip"` (not Finder's compress).
- After adding a file with a new `class_name`, run `Godot --headless --path eye_lab --import` **twice**;
  the first pass can report "Could not find type" before the class cache updates.
- `--check-only --script` reports false errors for autoload names (Lab, Filter, Iris, Sfx); use the
  import pass or a real run instead.
- Screenshot hook in `main.gd` (`_handle_cli`), run windowed (not headless):
  `Godot --path eye_lab --quit-after 900 -- --shot=<exercise key|menu> --out=/path.png [--wait=1.3] [--filter=N] [--intro] [--chat] [--profile] [--grownups[=tab 0-3]] [--splash]`
- `-- --iris-test="q1|q2"` (headless OK) asks Iris each question through the real server and prints
  replies and tool actions. This spends real API money; keep it to a few questions.
- `-- --export-sfx=<dir>` writes each UI sound to a WAV for listening.

## Whole-screen helper: macOS permission trap (read before touching `overlay/`)

- Screen-recording permission is tied to the exact signed build (ad-hoc cdhash). Any rebuild of the
  helper revokes it silently, even though System Settings still shows it enabled.
- The helper must never run from inside `Eye Lab.app`: macOS then attributes it to Eye Lab and every
  Eye Lab rebuild revokes the permission. Eye Lab ships it in `Contents/Resources/`, copies it to
  `~/Applications/Eye Lab Overlay.app` when the binary differs (md5), strips quarantine, and launches
  **that** copy via `open -a` (Launch Services, so the helper, not Eye Lab, is the permission subject).
- `overlay/build.sh` skips rebuilding when `main.swift`/`Info.plist` are unchanged; `--force` overrides.
  Only change the helper when necessary, and tell the user they'll need to re-allow it.
- Debugging: `log show --last 10m --predicate 'subsystem == "com.apple.TCC" AND eventMessage CONTAINS "eyelab"'`
  shows which bundle is the permission subject and whether the code requirement matched.
  `open -W --stdout f -a ~/Applications/Eye\ Lab\ Overlay.app --args --selftest` prints whether the
  GPU pipeline compiles and whether permission is granted, without capturing.
- Eye Lab ↔ helper talk through `user://overlay.json` (`{"mode", "lod", "gain", "keep", "mix"}`; mode 0 = quit;
  the last three are optional for older helpers), and the helper
  logs filter seconds to `user://overlay_time.json`, which `Lab.filter_minutes_on()` adds in.
  `Filter._sync_from_overlay` resets the toggle if the helper process isn't running.
- Protected video (Safari, Netflix app) captures as black; Chrome/Firefox work.

## Iris (Claude)

- The system prompt, tool schemas and model live **only on the server** (`iris-server/lib/iris.ts`);
  the app sends `{messages}` and runs tools locally (`eye_lab/autoload/iris.gd::_run_tool`). Tool names,
  game keys and filter modes must match across `lib/iris.ts`, `iris.gd` (GAMES / FILTER_MODES) and
  `main.gd` (EXERCISES).
- Model `claude-opus-5`, effort `low`, `fallbacks: "default"` with beta `server-side-fallback-2026-07-01`,
  `@anthropic-ai/sdk` pinned in `iris-server/package.json`. Deploy: `cd iris-server && vercel deploy --prod`
  (project `eye-lab-iris`, URL https://eye-lab-iris.vercel.app/api/iris).
- Vercel env: `ANTHROPIC_API_KEY`, `EYELAB_APP_KEY`. The app reads the same access code from
  `eye_lab/autoload/iris_secrets.gd` (git-ignored; copy the `.example.gd`). Never commit it.
- Players can set their own Claude API key in Settings › Iris (`user://iris.cfg`, kept out of
  `eye_lab.json` so `get_progress` never sees it). The app then sends `x-anthropic-key` instead of
  `x-eyelab-key`, and the server uses that key for the one call without storing or logging it.
- Iris must stay on-topic (app, games, filters, research, the player's progress), never diagnose or
  promise results, and use plain text with no emoji. Keep new prompt text consistent with that.

## Design and sound: what the user has asked for

- Visual language: Headspace sunset palette (orange → pink gradient, `core/mesh_background.gd`), white
  cards, flat icon tiles in four section hues that run sunset to dusk (`UI.CORAL`, `ROSE`, `PLUM`,
  `INDIGO`), one orange accent (`UI.ACCENT`) for every primary action, white pills over games (no dark
  chrome), **SF Pro** (`/System/Library/Fonts/SFNS.ttf`, weights 400/600; not the rounded font). Calm and careful, not cartoonish, not dark or glowy. Ask Iris is a
  floating button bottom-right; the chat opens above it. It should suit ages ~4–26.
- Rejected directions: toddler-style cartoon UI (big chunky tiles, clouds and hills), dark Inside Out
  space theme, cool-grey Apple glass. Don't drift back to these.
- Sounds (`autoload/sfx.gd`) are synthesised sine ticks in the same family as the hover tick, which the
  user liked. **Never use noise** (the user hated it) and avoid low, pitch-gliding "boops" for clicks.
  Keep everything very short and quiet.
- Every game opens on a "How to play" card with numbered `steps` (set in each exercise's `_setup`).

## Code conventions and gotchas

- UI is built in code, not scenes. Shared styling lives in `core/ui.gd` (palette, `apple_button`,
  `icon_tile`, `glass_panel`, `add_press_feel`) and `core/icons.gd` (inline SVG icons rendered at the
  HiDPI scale). The window uses `content_scale_factor = screen scale`, so all sizes are logical points;
  visual-angle maths (`Lab.px_per_deg()`) uses the same units, and card calibration measures them too.
- `GlassPanel` (`core/glass_panel.gd` + `shaders/glass.gdshader`) samples the screen texture: don't add
  stylebox shadows under it (they get blurred into the glass and look muddy). Its background is an
  internal child that must be re-sized after every container sort (`sort_children`).
- Controls inside a `CanvasLayer` don't inherit the window theme; set `theme = UI.theme()` on the root.
- GDScript: write lambdas multi-line (no `func(): if x: y()` one-liners); `:=` can't infer from
  Variant/Dictionary values, so type them explicitly.
- `Filter` swallows Tab / [ / ] / H shortcuts except while a LineEdit/TextEdit has focus (chat typing).
- Filter behaviour lives in `Filter.params` (`hp_lod`, `hp_gain`, `hp_keep`, `lp_lod`, `lp_mix`), saved in
  `Lab.settings["filter"]`; high-pass and low-pass each keep their own cutoff, and edges uses the
  high-pass values. Change them with `Filter.set_param` so the shader, helper and Settings stay in sync.
- Exercises extend `core/exercise.gd`: override `_setup/_begin/_draw_scene/_on_answer/_tick/_summary`,
  use `set_answers()` for clickable answers, `after()` for timers, `feedback(ok)` for sound and flash.
  Answers must be clickable; keyboard shortcuts are optional extras.
- Player data: `user://eye_lab.json` (~/Library/Application Support/Godot/app_userdata/Eye Lab/).

## Release checklist

1. `./build_all.sh`, then re-zip (see above), then smoke-test with the screenshot hook.
2. Confirm the helper is unchanged (`cmp` the bundled binary with `~/Applications/...`) or warn about re-permission.
3. Scan before pushing: `git grep --cached -nE "sk-ant-|<app key>"` must find nothing; PDFs stay ignored.
4. `gh release create vX.Y.Z "build/Eye Lab.zip" ...` with install notes (Open Anyway, Screen Recording, Chrome for Netflix).
