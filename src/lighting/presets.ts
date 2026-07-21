import { CUSTOM_LED_COUNT } from "../protocol/custom-lighting";
import type { RGBColor } from "../protocol/lighting";
import { AK820_KEY_GROUPS } from "./keyboard-layout";

export type CustomPreset = { name: string; create(): RGBColor[] };

const blank = () => Array.from({ length: CUSTOM_LED_COUNT }, () => ({ red: 0, green: 0, blue: 0 }));

export const CUSTOM_LIGHTING_PRESETS: readonly CustomPreset[] = [
  {
    name: "Red steady",
    create: () => blank().map(() => ({ red: 255, green: 0, blue: 0 })),
  },
  {
    name: "Ocean gradient",
    create: () =>
      blank().map((_, index) => ({
        red: 0,
        green: Math.round(70 + 90 * (index / (CUSTOM_LED_COUNT - 1))),
        blue: Math.round(150 + 105 * (index / (CUSTOM_LED_COUNT - 1))),
      })),
  },
  {
    name: "WASD accent",
    create: () => {
      const colors = blank().map(() => ({ red: 24, green: 35, blue: 60 }));
      for (const id of AK820_KEY_GROUPS.WASD) colors[id] = { red: 255, green: 80, blue: 30 };
      return colors;
    },
  },
  {
    name: "Rainbow rows",
    create: () => blank().map((_, index) => hslToRgb((index * 360) / CUSTOM_LED_COUNT)),
  },
];

function hslToRgb(hue: number): RGBColor {
  const channel = (offset: number) => {
    const value = (offset + hue / 30) % 12;
    return Math.round((255 * (1 - Math.max(-1, Math.min(value - 3, 9 - value, 1)))) / 2);
  };
  return { red: channel(0), green: channel(8), blue: channel(4) };
}
