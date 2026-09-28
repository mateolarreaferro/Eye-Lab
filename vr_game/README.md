# Vision Quest (VR)

A small Godot XR game built on the `godot-xr-template` (VRatMIT), for the
"Make a vision game" assignment. Where the desktop Eye Lab app applies its
spatial-frequency filter to the whole screen for both eyes, this applies it
**dichoptically** — differently per eye — which only a stereo headset can do.

## The idea

"Perceive More By Seeing Less" (and the dichoptic-rebalancing literature it
sits alongside) proposes that amblyopia treatment doesn't need to fully patch
the strong eye. Degrading the strong eye's contrast/low-frequency content by
just the right amount forces the visual system to recruit the weak eye,
while keeping both eyes open so binocular fusion cues survive. A monitor
can't target one eye without the other, but a VR headset renders each eye
separately, so it's a natural place to actually build this.

`shaders/dichoptic_filter.gdshader` is the same high-pass "frequency
patching" math as `eye_lab/shaders/filter.gdshader` (mode 1), gated by
Godot's `VIEW_INDEX` so it can render into just one eye's view. See
`scripts/dichoptic_filter.gd`.

**Two modes**, because amblyopia isn't always unilateral:
- **Dichoptic** (`filtered_eye` = Left/Right): the common case — one eye is
  measurably weaker than the other. Set this to the child's *dominant*
  (non-amblyopic) eye; filtering it stops that eye from dominating/
  suppressing the weak one. This only works when there's an asymmetry to
  correct.
- **Binocular** (`filtered_eye` = Both): for bilateral amblyopia, where
  neither eye dominates so there's nothing to rebalance against. Both eyes
  get the same filtered, harder-to-resolve view instead — general acuity/
  contrast training rather than interocular rebalancing, same idea as the
  desktop Eye Lab app's whole-screen filter.

Per-child mode should be set based on their actual diagnosis (which eye, if
either, is dominant) — this isn't something the game can infer on its own.

## The game

`scripts/vision_quest_game.gd`: the player is dropped at a random spawn
point in a small city; the objective is to spot and walk to a glowing
beacon placed at a different random point, using sight alone (no compass or
waypoint arrow — finding the beacon *is* the visual task, made harder by the
filter). Reaching it starts a new round at a new random spawn. Locomotion
is the template's stock joystick movement (`scripts/xr_move.gd`).

The city is placeholder procedural boxes right now — swap it for a Spline
export (`res://environment/city.glb`) by replacing the body of
`_build_placeholder_city()` in `vision_quest_game.gd` with an instanced GLB
scene, and pulling spawn points from `Marker3D` nodes placed in it. Nothing
else needs to change.

## Status / what's not tested yet

Godot isn't installed on the machine this was scaffolded on, so **none of
this has been opened in the editor yet**. Before relying on it:

1. Open the project in Godot 4.7, confirm it loads `main.tscn` without
   errors.
2. Install the Godot OpenXR Vendors plugin (Asset Store, top bar) if it
   isn't already — same step as the base template.
3. Check the dichoptic quad's facing/depth in-editor (`depth_test_disabled`
   + `cull_disabled` should make orientation robust, but verify visually)
   and that VIEW_INDEX gating actually renders one eye only when run on
   headset or in the OpenXR mobile mirror.
4. Tune `lod`/`gain` on `DichopticFilter` — these were ported from the
   desktop app's defaults, not tuned for VR FOV.

## Team

Sound design (once the world is playable): teammate TBD — see main repo
README for team structure. World geometry: swap-in point above is designed
so a Spline scene can replace the placeholder city without touching game
logic.
