import { describe, expect, test } from "vitest";
import { hexToRgb, rgbToHex } from "../color";

describe("lighting color conversion", () => {
  test.each([
    [{ red: 0, green: 0, blue: 0 }, "#000000"],
    [{ red: 255, green: 255, blue: 255 }, "#ffffff"],
    [{ red: 10, green: 132, blue: 255 }, "#0a84ff"],
  ] as const)("converts %o to %s and back", (rgb, hex) => {
    expect(rgbToHex(rgb)).toBe(hex);
    expect(hexToRgb(hex)).toEqual(rgb);
  });
});
