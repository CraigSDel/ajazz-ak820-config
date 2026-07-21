import type { RGBColor } from "../protocol/lighting";
import { CUSTOM_LED_COUNT } from "../protocol/custom-lighting";

export type LightingProfile = {
  version: 1;
  name: string;
  colors: RGBColor[];
};

export function serializeLightingProfile(name: string, colors: readonly RGBColor[]): string {
  return JSON.stringify({ version: 1, name: normalizedName(name), colors }, null, 2);
}

export function parseLightingProfile(source: string): LightingProfile {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("Invalid custom-lighting JSON file.");
  }
  if (!value || typeof value !== "object") throw new Error("Invalid custom-lighting profile.");
  const candidate = value as Partial<LightingProfile>;
  if (
    candidate.version !== 1 ||
    typeof candidate.name !== "string" ||
    !Array.isArray(candidate.colors)
  ) {
    throw new Error("Unsupported custom-lighting profile format.");
  }
  if (candidate.colors.length !== CUSTOM_LED_COUNT) {
    throw new Error(`A custom-lighting profile must contain ${CUSTOM_LED_COUNT} colors.`);
  }
  const colors = candidate.colors.map((color) => validateColor(color));
  return { version: 1, name: normalizedName(candidate.name), colors };
}

export function profileStorageKey(name: string): string {
  return `ak820-rgb-profile:${normalizedName(name)}`;
}

function normalizedName(name: string): string {
  const normalized = name.trim().slice(0, 50);
  if (!normalized) throw new Error("Profile name cannot be empty.");
  return normalized;
}

function validateColor(value: unknown): RGBColor {
  if (!value || typeof value !== "object") throw new Error("Profile contains an invalid color.");
  const color = value as Partial<RGBColor>;
  for (const channel of [color.red, color.green, color.blue]) {
    if (!Number.isInteger(channel) || (channel ?? -1) < 0 || (channel ?? 256) > 255) {
      throw new Error("Profile RGB channels must be integers from 0 through 255.");
    }
  }
  return { red: color.red as number, green: color.green as number, blue: color.blue as number };
}
