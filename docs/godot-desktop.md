# Eye Lab desktop app (Godot): notes

The original macOS app in `eye_lab/`, built by `build_all.sh` into `build/Eye Lab.app` with the helper
bundled inside. Superseded by the web version in `web/` (2026-10-08) but still buildable; the helper and
Iris server stay compatible with it (it passes `--state` to the helper and may send `x-eyelab-key`).

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

## Design (desktop app only; the web look is in CLAUDE.md)

- Desktop visual language: Headspace sunset palette (orange → pink gradient, `core/mesh_background.gd`), white
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
  `Lab.settings["filter"]`; high-pass and low-pass each keep their own cutoff (the only two filters;
  edges, invert and kaleidoscope were removed on purpose). Change them with `Filter.set_param` so the shader, helper and Settings stay in sync.
- Exercises extend `core/exercise.gd`: override `_setup/_begin/_draw_scene/_on_answer/_tick/_summary`,
  use `set_answers()` for clickable answers, `after()` for timers, `feedback(ok)` for sound and flash.
  Answers must be clickable; keyboard shortcuts are optional extras.
- Player data: `user://eye_lab.json` (~/Library/Application Support/Godot/app_userdata/Eye Lab/).

## Desktop release checklist

1. `./build_all.sh`, then re-zip (see above), then smoke-test with the screenshot hook.
2. Confirm the helper is unchanged (`cmp` the bundled binary with `~/Applications/...`) or warn about re-permission.
3. Scan before pushing: `git grep --cached -nE "sk-ant-|<app key>"` must find nothing; PDFs stay ignored.
4. `gh release create vX.Y.Z "build/Eye Lab.zip" ...` with install notes (Open Anyway, Screen Recording, Chrome for Netflix).
