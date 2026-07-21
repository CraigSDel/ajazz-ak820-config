import { LightingDirection, LightingMode, type LightingMode as Mode } from "../protocol/lighting";

export type EffectPreview = "off" | "steady";

export type LightingEffect = {
  mode: Mode;
  name: string;
  description: string;
  preview: EffectPreview;
  supportsColor: boolean;
  supportsPalette: boolean;
  supportsSpeed: boolean;
  directions: readonly (readonly [LightingDirection, string])[];
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
 * Keep effect labels tied to their protocol IDs. The physical animation for a
 * given ID varies across AK820 firmware, so the UI deliberately avoids naming
 * or simulating behavior that may not match the connected keyboard.
 */
type EffectOverride = Partial<
  Pick<LightingEffect, "supportsColor" | "supportsPalette" | "directions">
>;

/** Only firmware behavior that changes which controls the UI should expose. */
const EFFECT_OVERRIDES: Readonly<Partial<Record<Mode, EffectOverride>>> = {
  [LightingMode.Colourful]: { supportsColor: false, supportsPalette: false },
  [LightingMode.Spectrum]: { supportsColor: false, supportsPalette: false },
  [LightingMode.Scrolling]: { directions: VERTICAL },
  [LightingMode.Rolling]: { directions: HORIZONTAL },
  [LightingMode.Rotating]: { directions: HORIZONTAL },
  [LightingMode.Flowing]: { directions: HORIZONTAL },
  [LightingMode.Tilt]: { directions: HORIZONTAL },
};

const BUILT_IN_EFFECT_COUNT = 19;

export const LIGHTING_EFFECTS: readonly LightingEffect[] = [
  effect(LightingMode.Off, "Off", "Turn all key lighting off.", "off", false, false, NONE),
  ...Array.from({ length: BUILT_IN_EFFECT_COUNT }, (_, index) =>
    numberedEffect((index + 1) as Mode),
  ),
];

function numberedEffect(mode: Mode): LightingEffect {
  const override = EFFECT_OVERRIDES[mode];
  return effect(
    mode,
    `Effect ${mode}`,
    `Keyboard lighting effect ${mode}.`,
    "steady",
    override?.supportsColor ?? true,
    override?.supportsPalette ?? true,
    override?.directions ?? NONE,
  );
}

function effect(
  mode: Mode,
  name: string,
  description: string,
  preview: EffectPreview,
  supportsColor: boolean,
  supportsPalette: boolean,
  directions: LightingEffect["directions"],
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
  };
}

export function effectForMode(mode: Mode): LightingEffect {
  return LIGHTING_EFFECTS.find((effect) => effect.mode === mode) ?? LIGHTING_EFFECTS[0];
}
