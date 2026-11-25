import {
  type LightingConfig,
  LightingDirection,
  type LightingLevel,
  LightingMode,
  type LightingMode as ProtocolEffectId,
} from "../protocol/lighting";

export type EffectAnimationId =
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
  /** Stable value selected by the keyboard protocol. */
  protocolId: ProtocolEffectId;
  /** Human-facing, replaceable interpretation of the physical animation. */
  displayName: string;
  description: string;
  /** CSS animation used by the on-screen preview (approximate, not calibrated). */
  animationId: EffectAnimationId;
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
/** Preview cycle duration, in seconds, for firmware speed levels 1 through 5. */
export const EFFECT_SPEED_SECONDS = [2.4, 2, 1.6, 1.2, 0.8] as const;

/** Preview cycle duration for a speed level. Level 0 (Off) uses the middle speed. */
export function previewCycleSeconds(speed: LightingLevel = 3): number {
  return EFFECT_SPEED_SECONDS[speed - 1] ?? EFFECT_SPEED_SECONDS[2];
}

/**
 * Raw IDs, names, and control capabilities match the current OEM lighting
 * table and the AK820 Pro capture-backed implementations. Animation profiles
 * remain provisional until compared with recordings of the physical keyboard.
 */
export const LIGHTING_EFFECTS: readonly LightingEffect[] = [
  effect({
    mode: LightingMode.Off,
    name: "Off",
    description: "Turn all key lighting off.",
    animation: "off",
  }),
  effect({
    mode: LightingMode.Static,
    name: "Static",
    description: "A constant whole-keyboard color.",
    animation: "steady",
    color: true,
    palette: true,
  }),
  effect({
    mode: LightingMode.SingleKeyOn,
    name: "Single Key On",
    description: "Pressed keys light individually.",
    animation: "reactive-on",
    color: true,
    palette: true,
    reactive: true,
  }),
  effect({
    mode: LightingMode.SingleKeyOff,
    name: "Single Key Off",
    description: "Pressed keys turn off individually.",
    animation: "reactive-off",
    color: true,
    palette: true,
    reactive: true,
  }),
  effect({
    mode: LightingMode.Glittering,
    name: "Glittering",
    description: "Random keys glitter across the board.",
    animation: "twinkle",
    color: true,
    palette: true,
  }),
  effect({
    mode: LightingMode.Falling,
    name: "Falling",
    description: "Points of light fall down the keyboard.",
    animation: "snow",
    color: true,
    palette: true,
  }),
  effect({
    mode: LightingMode.Colourful,
    name: "Colourful",
    description: "A fixed multicolor floral pattern.",
    animation: "bloom",
  }),
  effect({
    mode: LightingMode.Breath,
    name: "Breath",
    description: "The whole keyboard fades in and out.",
    animation: "breath",
    color: true,
    palette: true,
  }),
  effect({
    mode: LightingMode.SpectrumCycle,
    name: "Spectrum Cycle",
    description: "The keyboard cycles through the color spectrum.",
    animation: "spectrum",
  }),
  effect({
    mode: LightingMode.Outward,
    name: "Outward",
    description: "Color spreads outward from the center.",
    animation: "fountain",
    color: true,
    palette: true,
  }),
  effect({
    mode: LightingMode.Scrolling,
    name: "Scrolling",
    description: "Bands travel vertically across the keyboard.",
    animation: "cross-wave",
    color: true,
    palette: true,
    directions: VERTICAL,
  }),
  effect({
    mode: LightingMode.Rolling,
    name: "Rolling",
    description: "A horizontal wave rolls across the keys.",
    animation: "rolling-wave",
    color: true,
    palette: true,
    directions: HORIZONTAL,
  }),
  effect({
    mode: LightingMode.Rotating,
    name: "Rotating",
    description: "A band rotates around the keyboard.",
    animation: "rotating-wave",
    color: true,
    palette: true,
    directions: HORIZONTAL,
  }),
  effect({
    mode: LightingMode.Explode,
    name: "Explode",
    description: "Pressed keys trigger an immediate burst.",
    animation: "burst",
    color: true,
    palette: true,
    reactive: true,
  }),
  effect({
    mode: LightingMode.Launch,
    name: "Launch",
    description: "Pressed keys launch light in two directions.",
    animation: "dual-trail",
    color: true,
    palette: true,
    reactive: true,
  }),
  effect({
    mode: LightingMode.Ripples,
    name: "Ripples",
    description: "Pressed keys emit an expanding ripple.",
    animation: "ripple",
    color: true,
    palette: true,
    reactive: true,
  }),
  effect({
    mode: LightingMode.Flowing,
    name: "Flowing",
    description: "A continuous horizontal stream crosses the board.",
    animation: "flow",
    color: true,
    palette: true,
    directions: HORIZONTAL,
  }),
  effect({
    mode: LightingMode.Pulsating,
    name: "Pulsating",
    description: "Overlapping waves rise and fall across the keys.",
    animation: "layered-wave",
    color: true,
    palette: true,
  }),
  effect({
    mode: LightingMode.Tilt,
    name: "Tilt",
    description: "Diagonal streaks move across the keyboard.",
    animation: "diagonal-rain",
    color: true,
    palette: true,
    directions: HORIZONTAL,
  }),
  effect({
    mode: LightingMode.Shuttle,
    name: "Shuttle",
    description: "A light band travels back and forth.",
    animation: "shuttle",
    color: true,
    palette: true,
  }),
];

type EffectDefinition = {
  mode: ProtocolEffectId;
  name: string;
  description: string;
  animation: EffectAnimationId;
  /** Accepts a user-chosen colour. */
  color?: boolean;
  /** Offers the built-in multicolour palette. */
  palette?: boolean;
  directions?: LightingEffect["directions"];
  /** Animates in response to key presses. */
  reactive?: boolean;
};

/** Fill in what an entry leaves out. Every effect except Off and Static has a speed. */
function effect(definition: EffectDefinition): LightingEffect {
  const { mode } = definition;
  return {
    protocolId: mode,
    displayName: definition.name,
    description: definition.description,
    animationId: definition.animation,
    supportsColor: definition.color ?? false,
    supportsPalette: definition.palette ?? false,
    supportsSpeed: mode !== LightingMode.Off && mode !== LightingMode.Static,
    directions: definition.directions ?? NONE,
    reactive: definition.reactive ?? false,
  };
}

export function effectForMode(protocolId: ProtocolEffectId): LightingEffect {
  return LIGHTING_EFFECTS.find((effect) => effect.protocolId === protocolId) ?? LIGHTING_EFFECTS[0];
}

/**
 * Clear settings the selected effect has no control for, so a choice made for
 * one effect (palette, direction) never leaks into another's preview or
 * packet. Unused values fall back to the defaults the hardware sweep tested:
 * palette off and direction 0.
 */
export function configForEffect(config: LightingConfig): LightingConfig {
  const effect = effectForMode(config.mode);
  const directions = effect.directions.map(([direction]) => direction);
  return {
    ...config,
    rainbow: effect.supportsPalette && config.rainbow,
    direction: directions.includes(config.direction)
      ? config.direction
      : (directions[0] ?? LightingDirection.Left),
  };
}
