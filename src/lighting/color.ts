import type { RGBColor } from "../protocol/lighting";

export function rgbToHex(color: RGBColor): string {
  return `#${[color.red, color.green, color.blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function hexToRgb(hex: string): RGBColor {
  return {
    red: Number.parseInt(hex.slice(1, 3), 16),
    green: Number.parseInt(hex.slice(3, 5), 16),
    blue: Number.parseInt(hex.slice(5, 7), 16),
  };
}
