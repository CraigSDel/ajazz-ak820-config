import { LightingDirection, LightingMode, type LightingMode as Mode } from "../protocol/lighting";

export type EffectPreview =
  | "off"
  | "steady"
  | "reactive-on"
  | "reactive-off"
  | "twinkle"
  | "snow"
  | "bloom"
  | "breath"
  | "spectrum"
  | "fountain"
  | "cross-wave"
  | "rolling-wave"
  | "rotating-wave"
  | "burst"
  | "dual-trail"
  | "ripple"
  | "flow"
  | "layered-wave"
  | "diagonal-rain"
  | "shuttle";

export type LightingEffect = {
  mode: Mode;
  name: string;
  description: string;
  preview: EffectPreview;
  supportsColor: boolean;
  supportsPalette: boolean;
  supportsSpeed: boolean;
  directions: readonly (readonly [LightingDirection, string])[];
  reactive: boolean;
};

const NONE = [] as const;
const HORIZONTAL = [
  [LightingDirection.Left, "Left"],
  [LightingDirection.Right, "Right"],
] as const;
const VERTICAL = [
  [LightingDirection.Up, "Up"],
  [LightingDirection.Down, "Down"],
] as const;

/**
 * AK820-family effect metadata, reconciled with the current official AJAZZ
 * driver catalogue. Names describe observed intent instead of literal,
 * ambiguous translations. Protocol IDs remain stable.
 */
export const LIGHTING_EFFECTS: readonly LightingEffect[] = [
  effect(LightingMode.Off, "Off", "Turn all key lighting off.", "off", false, false, NONE),
  effect(
    LightingMode.Static,
    "Steady",
    "A constant whole-keyboard color.",
    "steady",
    true,
    true,
    NONE,
  ),
  effect(
    LightingMode.SingleOn,
    "Key Press — Light Up",
    "Pressed keys light individually.",
    "reactive-on",
    true,
    true,
    NONE,
    true,
  ),
  effect(
    LightingMode.SingleOff,
    "Key Press — Fade Out",
    "Pressed keys fade from the selected color.",
    "reactive-off",
    true,
    true,
    NONE,
    true,
  ),
  effect(
    LightingMode.Glittering,
    "Twinkling Stars",
    "Random keys sparkle across the board.",
    "twinkle",
    true,
    true,
    NONE,
  ),
  effect(
    LightingMode.Falling,
    "Falling Snow",
    "Points of light fall down the keyboard.",
    "snow",
    true,
    true,
    NONE,
  ),
  effect(
    LightingMode.Colourful,
    "Color Bloom",
    "A fixed multicolor floral pattern.",
    "bloom",
    false,
    false,
    NONE,
  ),
  effect(
    LightingMode.Breath,
    "Breathing",
    "The whole keyboard fades in and out.",
    "breath",
    true,
    true,
    NONE,
  ),
  effect(
    LightingMode.Spectrum,
    "Spectrum Cycle",
    "The keyboard cycles through the color spectrum.",
    "spectrum",
    false,
    false,
    NONE,
  ),
  effect(
    LightingMode.Outward,
    "Color Fountain",
    "Color rises and spreads outward from the center.",
    "fountain",
    true,
    true,
    NONE,
  ),
  effect(
    LightingMode.Scrolling,
    "Cross-Wave",
    "Bands travel vertically across the keyboard.",
    "cross-wave",
    true,
    true,
    VERTICAL,
  ),
  effect(
    LightingMode.Rolling,
    "Rolling Wave",
    "A horizontal wave rolls across the keys.",
    "rolling-wave",
    true,
    true,
    HORIZONTAL,
  ),
  effect(
    LightingMode.Rotating,
    "Rotating Wave",
    "A band rotates around the keyboard.",
    "rotating-wave",
    true,
    true,
    HORIZONTAL,
  ),
  effect(
    LightingMode.Explode,
    "Key Press — Burst",
    "Pressed keys trigger an immediate burst.",
    "burst",
    true,
    true,
    NONE,
    true,
  ),
  effect(
    LightingMode.Launch,
    "Key Press — Dual Trail",
    "Pressed keys launch light in two directions.",
    "dual-trail",
    true,
    true,
    NONE,
    true,
  ),
  effect(
    LightingMode.Ripples,
    "Key Press — Ripple",
    "Pressed keys emit an expanding ripple.",
    "ripple",
    true,
    true,
    NONE,
    true,
  ),
  effect(
    LightingMode.Flowing,
    "Continuous Flow",
    "A continuous horizontal stream crosses the board.",
    "flow",
    true,
    true,
    HORIZONTAL,
  ),
  effect(
    LightingMode.Pulsating,
    "Layered Wave",
    "Overlapping waves rise and fall across the keys.",
    "layered-wave",
    true,
    true,
    NONE,
  ),
  effect(
    LightingMode.Tilt,
    "Diagonal Rain",
    "Diagonal streaks move across the keyboard.",
    "diagonal-rain",
    true,
    true,
    HORIZONTAL,
  ),
  effect(
    LightingMode.Shuttle,
    "Shuttle",
    "A light band travels back and forth.",
    "shuttle",
    true,
    true,
    NONE,
  ),
];

function effect(
  mode: Mode,
  name: string,
  description: string,
  preview: EffectPreview,
  supportsColor: boolean,
  supportsPalette: boolean,
  directions: LightingEffect["directions"],
  reactive = false,
): LightingEffect {
  return {
    mode,
    name,
    description,
    preview,
    supportsColor,
    supportsPalette,
    supportsSpeed: mode !== LightingMode.Off && mode !== LightingMode.Static,
    directions,
    reactive,
  };
}

export function effectForMode(mode: Mode): LightingEffect {
  return LIGHTING_EFFECTS.find((effect) => effect.mode === mode) ?? LIGHTING_EFFECTS[0];
}
