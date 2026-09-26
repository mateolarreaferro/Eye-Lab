# Eye Lab

A macOS app of vision games and tests, with the spatial-frequency filters from
*Perceive More By Seeing Less* and exercises from the Sinha lab's VR vision work
(Project Prakash). It includes a whole-screen filter for any app or video, and
**Iris**, a guide powered by Claude.

**[Download the latest release](../../releases/latest)** (macOS 14+, Apple Silicon and Intel).

## What's inside

- **Eye check-up:** Letter E (tumbling-E acuity, logMAR), Faint stripes (contrast sensitivity at 4 spatial frequencies), Dot hunt (visual field map).
- **Spot the odd one:** color, letter direction, stripe tilt and red/cyan stereo depth, anywhere along the visual field.
- **Brain games:** counting lights, "Did it move?", multiple object tracking, directed search, Pong with a hidden middle.
- **Magic glasses:** webcam, scene or picture through the filters, plus **Whole screen** mode that filters the entire Mac.
- **Filters:** high-pass ("frequency patching"), low-pass, edges, invert, kaleidoscope, with a coarse-to-fine cutoff.
- **My profile:** trophies, day streak, filter time, test history and badges.
- **Iris:** answers questions about the app and the research, opens games and sets filters. Declines anything off-topic.

Eye Lab is a research and training toy, not a medical device. It doesn't diagnose or treat anything.

## Installing

1. Download `Eye Lab.zip` from the release and unzip it.
2. The app isn't notarized yet, so the first time, open **System Settings › Privacy & Security** and click **Open Anyway**.
3. For **Whole screen**, allow **Eye Lab Overlay** under **Screen & System Audio Recording** when asked, then turn Whole screen on again.
4. For Netflix and other protected video with the filter on, use Chrome or Firefox (Safari shows protected video as black).

## Repository layout

| Folder | What it is |
|---|---|
| `eye_lab/` | The Godot 4.7 project (games, filters, UI, Iris client). |
| `overlay/` | `Eye Lab Overlay.app`: Swift helper that filters the whole screen (ScreenCaptureKit + Metal). |
| `iris-server/` | Vercel function that holds the Claude API key and Iris's prompt and tools. |
| `build_all.sh` | Builds the helper, exports Eye Lab, bundles the helper and signs the app. |

## Building

Requirements: Godot 4.7.2 with macOS export templates, Xcode command line tools.

```sh
cp eye_lab/autoload/iris_secrets.example.gd eye_lab/autoload/iris_secrets.gd   # set APP_KEY
GODOT=/path/to/Godot.app/Contents/MacOS/Godot ./build_all.sh
```

The app is written to `build/Eye Lab.app`. To deploy the Iris server, see [`iris-server/README.md`](iris-server/README.md).
