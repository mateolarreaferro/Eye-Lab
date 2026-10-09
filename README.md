# Eye Lab

Vision games, tests and spatial-frequency filters, with exercises from the Sinha lab's VR vision
work (Project Prakash) and the filters from *Perceive More By Seeing Less*. It runs in the browser,
can filter your whole Mac screen with a small helper app, and has **Iris**, a guide powered by Claude.

**[Open Eye Lab](https://mateolarreaferro.com/eyelab)**

## What's inside

- **Eye check-up:** Letter E (tumbling-E acuity, logMAR), Faint stripes (contrast sensitivity at 4 spatial frequencies), Dot hunt (visual field map).
- **Spot the odd one:** color, letter direction, stripe tilt and red/cyan stereo depth, anywhere along the visual field.
- **Brain games:** counting lights, "Did it move?", multiple object tracking, visual search, Pong with a hidden middle.
- **Magic glasses:** your webcam, a scene or a picture through the filters, plus **Whole screen**, which filters the entire Mac.
- **Filters:** high-pass ("frequency patching") and low-pass, with a coarse-to-fine cutoff. **Settings, Filters** has sliders for contrast boost, how much of the coarse image high-pass keeps, and low-pass strength.
- **Progress:** trophies, day streak, filter time, test history and badges. Everything stays in your browser.
- **Iris:** answers questions about the games and the research, opens games and sets filters. Add your own Claude API key in **Settings, Iris** ([get one here](https://console.anthropic.com/settings/keys)).

Eye Lab is a research and training toy, not a medical device. It doesn't diagnose or treat anything.
For accurate test sizes, run **Calibrate with a card** in Settings and set your viewing distance.

## Whole screen (macOS)

1. Download `Eye Lab Overlay.zip` from the [latest release](../../releases/latest), unzip it and move **Eye Lab Overlay** to Applications.
2. Open it once. It isn't notarized yet, so if macOS blocks it, click **Open Anyway** in System Settings, Privacy & Security.
3. Allow **Eye Lab Overlay** under **Screen & System Audio Recording**.
4. In Eye Lab, open **Magic glasses** and switch **Whole screen** on. Your browser asks once whether to open the helper and whether the page may talk to it.

For Netflix and other protected video, use Chrome or Firefox (Safari shows protected video as black).

## Repository layout

| Folder | What it is |
|---|---|
| `web/` | The app: React, Vite, Tailwind and Motion. |
| `overlay/` | `Eye Lab Overlay.app`, the Swift helper that filters the whole screen (ScreenCaptureKit and Metal). |
| `iris-server/` | Vercel function that holds Iris's prompt and tools. |
| `eye_lab/` | The original Godot desktop app, kept for reference. See `docs/godot-desktop.md`. |
| `contrib/vision_quest_vr/` | Samiksha Singh's separate VR project: a dichoptic game built on the frequency-patching filter. See its README. |

## Developing

```sh
cd web && npm install && npm run dev     # the app at http://localhost:5173
./overlay/build.sh                        # the helper, into build/
```

The site copy is built by mateolarreaferro.com's `npm run sync:demos -- eyelab`. To deploy the Iris
server, see [`iris-server/README.md`](iris-server/README.md).
