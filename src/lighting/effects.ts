import {
  LightingDirection,
  LightingMode,
  type LightingMode as ProtocolEffectId,
} from "../protocol/lighting";

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
  /** Stable value selected by the keyboard protocol. */
  protocolId: ProtocolEffectId;
  /** Human-facing, replaceable interpretation of the physical animation. */
  displayName: string;
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
 * Raw IDs, names, and control capabilities match the current OEM lighting
 * table and the AK820 Pro capture-backed implementations. Preview artwork is
 * an approximate presentation of those firmware effects.
 */
export const LIGHTING_EFFECTS: readonly LightingEffect[] = [
  effect(LightingMode.Off, "Off", "Turn all key lighting off.", "off", false, false, NONE),
  effect(
    LightingMode.Effect1,
    "Static",
    "A constant whole-keyboard color.",
    "steady",
    true,
    true,
    NONE,
  ),
  effect(
    LightingMode.Effect2,
    "Single Key On",
    "Pressed keys light individually.",
    "reactive-on",
    true,
    true,
    NONE,
    true,
  ),
  effect(
    LightingMode.Effect3,
    "Single Key Off",
    "Pressed keys turn off individually.",
    "reactive-off",
    true,
    true,
    NONE,
    true,
  ),
  effect(
    LightingMode.Effect4,
    "Glittering",
    "Random keys glitter across the board.",
    "twinkle",
    true,
    true,
    NONE,
  ),
  effect(
    LightingMode.Effect5,
    "Falling",
    "Points of light fall down the keyboard.",
    "snow",
    true,
    true,
    NONE,
  ),
  effect(
    LightingMode.Effect6,
    "Colourful",
    "A fixed multicolor floral pattern.",
    "bloom",
    false,
    false,
    NONE,
  ),
  effect(
    LightingMode.Effect7,
    "Breath",
    "The whole keyboard fades in and out.",
    "breath",
    true,
    true,
    NONE,
  ),
  effect(
    LightingMode.Effect8,
    "Spectrum Cycle",
    "The keyboard cycles through the color spectrum.",
    "spectrum",
    false,
    false,
    NONE,
  ),
  effect(
    LightingMode.Effect9,
    "Outward",
    "Color spreads outward from the center.",
    "fountain",
    true,
    true,
    NONE,
  ),
  effect(
    LightingMode.Effect10,
    "Scrolling",
    "Bands travel vertically across the keyboard.",
    "cross-wave",
    true,
    true,
    VERTICAL,
  ),
  effect(
    LightingMode.Effect11,
    "Rolling",
    "A horizontal wave rolls across the keys.",
    "rolling-wave",
    true,
    true,
    HORIZONTAL,
  ),
  effect(
    LightingMode.Effect12,
    "Rotating",
    "A band rotates around the keyboard.",
    "rotating-wave",
    true,
    true,
    HORIZONTAL,
  ),
  effect(
    LightingMode.Effect13,
    "Explode",
    "Pressed keys trigger an immediate burst.",
    "burst",
    true,
    true,
    NONE,
    true,
  ),
  effect(
    LightingMode.Effect14,
    "Launch",
    "Pressed keys launch light in two directions.",
    "dual-trail",
    true,
    true,
    NONE,
    true,
  ),
  effect(
    LightingMode.Effect15,
    "Ripples",
    "Pressed keys emit an expanding ripple.",
    "ripple",
    true,
    true,
    NONE,
    true,
  ),
  effect(
    LightingMode.Effect16,
    "Flowing",
    "A continuous horizontal stream crosses the board.",
    "flow",
    true,
    true,
    HORIZONTAL,
  ),
  effect(
    LightingMode.Effect17,
    "Pulsating",
    "Overlapping waves rise and fall across the keys.",
    "layered-wave",
    true,
    true,
    NONE,
  ),
  effect(
    LightingMode.Effect18,
    "Tilt",
    "Diagonal streaks move across the keyboard.",
    "diagonal-rain",
    true,
    true,
    HORIZONTAL,
  ),
  effect(
    LightingMode.Effect19,
    "Shuttle",
    "A light band travels back and forth.",
    "shuttle",
    true,
    true,
    NONE,
  ),
];

function effect(
  protocolId: ProtocolEffectId,
  displayName: string,
  description: string,
  preview: EffectPreview,
  supportsColor: boolean,
  supportsPalette: boolean,
  directions: LightingEffect["directions"],
  reactive = false,
): LightingEffect {
  return {
    protocolId,
    displayName,
    description,
    preview,
    supportsColor,
    supportsPalette,
    supportsSpeed: protocolId !== LightingMode.Off && protocolId !== LightingMode.Effect1,
    directions,
    reactive,
  };
}

export function effectForMode(protocolId: ProtocolEffectId): LightingEffect {
  return LIGHTING_EFFECTS.find((effect) => effect.protocolId === protocolId) ?? LIGHTING_EFFECTS[0];
}
