import { describe, expect, test } from "vitest";
import { LightingMode } from "../../protocol/lighting";
import { effectForMode, LIGHTING_EFFECTS } from "../effects";

describe("AK820 lighting effect metadata", () => {
  test("covers off plus every official built-in effect exactly once", () => {
    expect(LIGHTING_EFFECTS.map((effect) => effect.mode)).toEqual(
      Array.from({ length: 20 }, (_, mode) => mode),
    );
  });

  test("uses neutral protocol-number labels and non-animated previews", () => {
    expect(LIGHTING_EFFECTS.map((effect) => effect.name)).toEqual([
      "Off",
      ...Array.from({ length: 19 }, (_, index) => `Effect ${index + 1}`),
    ]);
    expect(LIGHTING_EFFECTS.slice(1).every((effect) => effect.preview === "steady")).toBe(true);
  });

  test("fixed-palette effects do not advertise custom colors", () => {
    expect(effectForMode(LightingMode.Colourful).supportsColor).toBe(false);
    expect(effectForMode(LightingMode.Spectrum).supportsColor).toBe(false);
  });

  test("offers the official RGB palette switch for steady lighting", () => {
    expect(effectForMode(LightingMode.Static).supportsPalette).toBe(true);
  });

  test("matches the official directional modes", () => {
    const directional = LIGHTING_EFFECTS.filter((effect) => effect.directions.length > 0).map(
      (effect) => effect.mode,
    );
    expect(directional).toEqual([
      LightingMode.Scrolling,
      LightingMode.Rolling,
      LightingMode.Rotating,
      LightingMode.Flowing,
      LightingMode.Tilt,
    ]);
  });
});
