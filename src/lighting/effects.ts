import {
  LightingDirection,
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

export type EffectAnimationProfile = {
  id: EffectAnimationId;
  spatial:
    | "none"
    | "uniform"
    | "random"
    | "vertical"
    | "horizontal"
    | "radial"
    | "diagonal"
    | "rotational";
  palette: "selected" | "selectable" | "fixed-rainbow";
  envelope: "constant" | "pulse" | "spark" | "trail" | "reactive-on" | "reactive-off";
  /** Cycle duration, in seconds, for firmware speed levels 1 through 5. */
  speedSeconds: readonly [number, number, number, number, number];
  direction: "none" | "horizontal" | "vertical";
  propagation: "none" | "origin" | "radial" | "horizontal";
  calibrated: boolean;
};

export type LightingEffect = {
  /** Stable value selected by the keyboard protocol. */
  protocolId: ProtocolEffectId;
  /** Human-facing, replaceable interpretation of the physical animation. */
  displayName: string;
  description: string;
  animation: EffectAnimationProfile;
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
const SPEED_SECONDS = [2.4, 2, 1.6, 1.2, 0.8] as const;

/**
 * Raw IDs, names, and control capabilities match the current OEM lighting
 * table and the AK820 Pro capture-backed implementations. Animation profiles
 * remain provisional until compared with recordings of the physical keyboard.
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
  animationId: EffectAnimationId,
  supportsColor: boolean,
  supportsPalette: boolean,
  directions: LightingEffect["directions"],
  reactive = false,
): LightingEffect {
  return {
    protocolId,
    displayName,
    description,
    animation: animationProfile(animationId),
    supportsColor,
    supportsPalette,
    supportsSpeed: protocolId !== LightingMode.Off && protocolId !== LightingMode.Effect1,
    directions,
    reactive,
  };
}

function animationProfile(id: EffectAnimationId): EffectAnimationProfile {
  const profiles: Record<
    EffectAnimationId,
    Omit<EffectAnimationProfile, "id" | "speedSeconds" | "calibrated">
  > = {
    off: {
      spatial: "none",
      palette: "selected",
      envelope: "constant",
      direction: "none",
      propagation: "none",
    },
    steady: {
      spatial: "uniform",
      palette: "selectable",
      envelope: "constant",
      direction: "none",
      propagation: "none",
    },
    "reactive-on": {
      spatial: "uniform",
      palette: "selectable",
      envelope: "reactive-on",
      direction: "none",
      propagation: "origin",
    },
    "reactive-off": {
      spatial: "uniform",
      palette: "selectable",
      envelope: "reactive-off",
      direction: "none",
      propagation: "origin",
    },
    twinkle: {
      spatial: "random",
      palette: "selectable",
      envelope: "spark",
      direction: "none",
      propagation: "none",
    },
    snow: {
      spatial: "vertical",
      palette: "selectable",
      envelope: "trail",
      direction: "none",
      propagation: "none",
    },
    bloom: {
      spatial: "radial",
      palette: "fixed-rainbow",
      envelope: "pulse",
      direction: "none",
      propagation: "none",
    },
    breath: {
      spatial: "uniform",
      palette: "selectable",
      envelope: "pulse",
      direction: "none",
      propagation: "none",
    },
    spectrum: {
      spatial: "horizontal",
      palette: "fixed-rainbow",
      envelope: "constant",
      direction: "none",
      propagation: "none",
    },
    fountain: {
      spatial: "radial",
      palette: "selectable",
      envelope: "trail",
      direction: "none",
      propagation: "radial",
    },
    "cross-wave": {
      spatial: "vertical",
      palette: "selectable",
      envelope: "trail",
      direction: "vertical",
      propagation: "none",
    },
    "rolling-wave": {
      spatial: "horizontal",
      palette: "selectable",
      envelope: "trail",
      direction: "horizontal",
      propagation: "none",
    },
    "rotating-wave": {
      spatial: "rotational",
      palette: "selectable",
      envelope: "trail",
      direction: "horizontal",
      propagation: "none",
    },
    burst: {
      spatial: "radial",
      palette: "selectable",
      envelope: "reactive-on",
      direction: "none",
      propagation: "radial",
    },
    "dual-trail": {
      spatial: "horizontal",
      palette: "selectable",
      envelope: "reactive-on",
      direction: "none",
      propagation: "horizontal",
    },
    ripple: {
      spatial: "radial",
      palette: "selectable",
      envelope: "reactive-on",
      direction: "none",
      propagation: "radial",
    },
    flow: {
      spatial: "horizontal",
      palette: "selectable",
      envelope: "trail",
      direction: "horizontal",
      propagation: "none",
    },
    "layered-wave": {
      spatial: "diagonal",
      palette: "selectable",
      envelope: "pulse",
      direction: "none",
      propagation: "none",
    },
    "diagonal-rain": {
      spatial: "diagonal",
      palette: "selectable",
      envelope: "trail",
      direction: "horizontal",
      propagation: "none",
    },
    shuttle: {
      spatial: "horizontal",
      palette: "selectable",
      envelope: "trail",
      direction: "none",
      propagation: "none",
    },
  };
  return { id, ...profiles[id], speedSeconds: SPEED_SECONDS, calibrated: false };
}

export function effectForMode(protocolId: ProtocolEffectId): LightingEffect {
  return LIGHTING_EFFECTS.find((effect) => effect.protocolId === protocolId) ?? LIGHTING_EFFECTS[0];
}
