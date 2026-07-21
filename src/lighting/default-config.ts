import {
  type LightingConfig,
  LightingDirection,
  LightingMode,
} from "../protocol/lighting";

/** Shared baseline used by both normal lighting and hardware validation. */
export const DEFAULT_LIGHTING_CONFIG: LightingConfig = {
  mode: LightingMode.Static,
  color: { red: 255, green: 0, blue: 0 },
  rainbow: false,
  brightness: 5,
  speed: 3,
  direction: LightingDirection.Left,
};
