import { describe, expect, test } from "vitest";
import { LightingMode } from "../../protocol/lighting";
import { effectForMode, LIGHTING_EFFECTS } from "../effects";

describe("AK820 lighting effect metadata", () => {
  test("covers off plus every official built-in effect exactly once", () => {
    expect(LIGHTING_EFFECTS.map((effect) => effect.mode)).toEqual(
      Array.from({ length: 20 }, (_, mode) => mode),
    );
  });

  test("fixed-palette effects do not advertise custom colors", () => {
    expect(effectForMode(LightingMode.Colourful).supportsColor).toBe(false);
    expect(effectForMode(LightingMode.Spectrum).supportsColor).toBe(false);
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

  test("identifies all key-reactive modes", () => {
    expect(
      LIGHTING_EFFECTS.filter((effect) => effect.reactive).map((effect) => effect.mode),
    ).toEqual([
      LightingMode.SingleOn,
      LightingMode.SingleOff,
      LightingMode.Explode,
      LightingMode.Launch,
      LightingMode.Ripples,
    ]);
  });
});
