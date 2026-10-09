import type { Icon } from "@phosphor-icons/react";
import {
  ArrowsOutCardinal, Barcode, Brain, Camera, CircleHalf, CirclesThree, CreditCard, Crosshair, Cube, Eye,
  Eyeglasses, Lightbulb, ScanSmiley, MagnifyingGlass, Palette, PingPong, Shapes, TextAa,
} from "@phosphor-icons/react";
import type { Exercise } from "../exercise/Exercise";

/*
  Every section and game. Keys match the desktop app (main.gd EXERCISES) and
  Iris's open_game tool on the server (iris-server/lib/iris.ts), so Iris keeps
  working unchanged. Each game module default-exports an Exercise subclass and
  is loaded on demand.
*/

export interface Section {
  key: string;
  name: string;
  tag: string;
  icon: Icon;
  /** The two pastel stops of the section's atmospheric orb (CSS colours). */
  orb: string;
  orb2: string;
}

export interface GameDef {
  key: string;
  section: string;
  name: string;
  tag: string;
  desc: string;
  icon: Icon;
  config?: Record<string, unknown>;
  load: () => Promise<{ default: new () => Exercise }>;
}

export const SECTIONS: Section[] = [
  { key: "checkup", name: "Eye check-up", tag: "Measure how you see", icon: Eye, orb: "var(--color-orb-4)", orb2: "var(--color-orb-1)" },
  { key: "odd", name: "Spot the odd one", tag: "Train fine detail", icon: Shapes, orb: "var(--color-orb-2)", orb2: "var(--color-orb-5)" },
  { key: "brain", name: "Brain games", tag: "Attention and space", icon: Brain, orb: "var(--color-orb-1)", orb2: "var(--color-orb-4)" },
  { key: "glasses", name: "Magic glasses", tag: "See less, perceive more", icon: Eyeglasses, orb: "var(--color-orb-3)", orb2: "var(--color-orb-2)" },
];

/** A deeper shade of each section's orb, for canvas drawing (e.g. the calibration card outline). */
export const SECTION_HEX: Record<string, string> = {
  checkup: "#4f7fa8",
  odd: "#b5714a",
  brain: "#3f8f78",
  glasses: "#7a63a8",
};

export const GAMES: GameDef[] = [
  { key: "acuity", section: "checkup", name: "Letter E", tag: "Smallest letter", desc: "Acuity test: which way does the E point?", icon: TextAa, load: () => import("../exercises/acuity") },
  { key: "contrast", section: "checkup", name: "Faint stripes", tag: "Faintest pattern", desc: "Contrast sensitivity: how faint can you see?", icon: CircleHalf, load: () => import("../exercises/contrast") },
  { key: "field_map", section: "checkup", name: "Dot hunt", tag: "Your field of view", desc: "Visual field map: spot dots around the edges", icon: Crosshair, load: () => import("../exercises/fieldMap") },
  { key: "eye_movement", section: "checkup", name: "Eye movement", tag: "Webcam eye tracking", desc: "Watch a star: how steady are the eyes, and do they follow?", icon: ScanSmiley, load: () => import("../exercises/eyeMovement") },
  { key: "odd_color", section: "odd", name: "Colors", tag: "Hue difference", desc: "Which disk has a different color?", icon: Palette, config: { mode: "color" }, load: () => import("../exercises/oddOneOut") },
  { key: "odd_acuity", section: "odd", name: "Letters", tag: "Letter direction", desc: "Which E points another way?", icon: TextAa, config: { mode: "acuity" }, load: () => import("../exercises/oddOneOut") },
  { key: "odd_orientation", section: "odd", name: "Stripes", tag: "Tilt difference", desc: "Which stripes are tilted?", icon: Barcode, config: { mode: "orientation" }, load: () => import("../exercises/oddOneOut") },
  { key: "odd_depth", section: "odd", name: "3D", tag: "Red/cyan glasses", desc: "Needs red/cyan 3D glasses", icon: Cube, config: { mode: "depth" }, load: () => import("../exercises/oddOneOut") },
  { key: "spot_count", section: "brain", name: "Count lights", tag: "Quick flashes", desc: "How many lights flashed?", icon: Lightbulb, load: () => import("../exercises/spotCount") },
  { key: "location", section: "brain", name: "Did it move?", tag: "Spatial memory", desc: "Same place, or did the light move?", icon: ArrowsOutCardinal, load: () => import("../exercises/location") },
  { key: "mot", section: "brain", name: "Follow dots", tag: "Multiple tracking", desc: "Keep track of the marked dots", icon: CirclesThree, load: () => import("../exercises/mot") },
  { key: "search", section: "brain", name: "Find it", tag: "Visual search", desc: "Find the shape in the crowd", icon: MagnifyingGlass, load: () => import("../exercises/search") },
  { key: "pong", section: "brain", name: "Pong", tag: "Predictive pursuit", desc: "Bounce the ball back", icon: PingPong, load: () => import("../exercises/pong") },
  { key: "patch_room", section: "glasses", name: "Magic glasses", tag: "Webcam through a filter", desc: "See the world through a filter (frequency patching)", icon: Camera, load: () => import("../exercises/patchRoom") },
];

/** Not on the home screen: opened from Settings. */
export const CALIBRATE: GameDef = {
  key: "calibrate", section: "checkup", name: "Calibrate screen", tag: "Match a bank card", desc: "", icon: CreditCard,
  load: () => import("../exercises/calibrate"),
};

export const sectionOf = (g: GameDef) => SECTIONS.find((s) => s.key === g.section)!;
export const gameByKey = (key: string) => [...GAMES, CALIBRATE].find((g) => g.key === key);
