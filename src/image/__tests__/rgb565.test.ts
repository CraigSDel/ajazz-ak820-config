import { describe, expect, test } from "vitest";
import { rgb888ToRgb565 } from "../rgb565";

describe("rgb888ToRgb565", () => {
  test("converts pure black", () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 255]);
    const out = rgb888ToRgb565(rgba, 1, 1, "le");
    expect(Array.from(out)).toEqual([0x00, 0x00]);
  });

  test("converts pure white", () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255]);
    const out = rgb888ToRgb565(rgba, 1, 1, "le");
    expect(Array.from(out)).toEqual([0xff, 0xff]);
  });

  test("converts pure red (R=255 → top 5 bits = 0b11111)", () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
    const out = rgb888ToRgb565(rgba, 1, 1, "le");
    // RGB565 layout: RRRRR GGGGGG BBBBB = 0xF800
    // little-endian byte order: 0x00, 0xF8
    expect(Array.from(out)).toEqual([0x00, 0xf8]);
  });

  test("output size matches width * height * 2 bytes", () => {
    const pixels = 128 * 128;
    const rgba = new Uint8ClampedArray(pixels * 4);
    const out = rgb888ToRgb565(rgba, 128, 128, "le");
    expect(out.byteLength).toBe(pixels * 2);
  });
});

describe("rgb888ToRgb565 dithering", () => {
  const solid = (value: [number, number, number], size = 4) => {
    const rgba = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i++) rgba.set([...value, 255], i * 4);
    return rgba;
  };
  const words = (out: Uint8Array) =>
    Array.from({ length: out.length / 2 }, (_, i) => out[i * 2] | (out[i * 2 + 1] << 8));

  test("leaves exactly representable colours perfectly flat", () => {
    for (const color of [
      [0, 0, 0],
      [255, 255, 255],
      [248, 252, 248],
      [64, 128, 32],
    ] as [number, number, number][]) {
      const out = words(rgb888ToRgb565(solid(color), 4, 4, "le", { dither: true }));
      expect(new Set(out).size).toBe(1);
    }
  });

  test("mixes neighbouring levels so in-between shades average correctly", () => {
    // Red 244 sits halfway between the 5-bit levels 240 and 248.
    const out = words(rgb888ToRgb565(solid([244, 0, 0]), 4, 4, "le", { dither: true }));
    const reds = out.map((word) => (word >> 11) & 0x1f);
    expect(new Set(reds)).toEqual(new Set([30, 31]));
    expect(reds.filter((red) => red === 31)).toHaveLength(8);
  });
});
