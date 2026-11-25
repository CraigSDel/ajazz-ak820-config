import { describe, expect, test } from "vitest";
import { LightingDirection, LightingMode } from "../../protocol/lighting";
import { configForEffect, EFFECT_SPEED_SECONDS, effectForMode, LIGHTING_EFFECTS } from "../effects";

describe("AK820 lighting effect metadata", () => {
  test("covers off plus every protocol effect ID exactly once", () => {
    expect(LIGHTING_EFFECTS.map((effect) => effect.protocolId)).toEqual(
      Array.from({ length: 20 }, (_, protocolId) => protocolId),
    );
  });

  test("keeps human-facing labels separate from protocol identifiers", () => {
    expect(effectForMode(LightingMode.Static)).toMatchObject({
      protocolId: 1,
      displayName: "Static",
      animationId: "steady",
    });
    expect(effectForMode(LightingMode.Ripples)).toMatchObject({
      protocolId: 15,
      displayName: "Ripples",
      animationId: "ripple",
    });
  });

  test("gives every effect a distinct preview animation", () => {
    const ids = LIGHTING_EFFECTS.map(({ animationId }) => animationId);
    expect(new Set(ids).size).toBe(LIGHTING_EFFECTS.length);
    expect(EFFECT_SPEED_SECONDS).toHaveLength(5);
  });

  test("previews the Outward effect with the fountain animation", () => {
    expect(effectForMode(LightingMode.Outward).animationId).toBe("fountain");
  });

  test("fixed-palette effects do not advertise custom colors", () => {
    expect(effectForMode(LightingMode.Colourful).supportsColor).toBe(false);
    expect(effectForMode(LightingMode.SpectrumCycle).supportsColor).toBe(false);
  });

  test("offers the palette switch for the provisional steady effect", () => {
    expect(effectForMode(LightingMode.Static).supportsPalette).toBe(true);
  });

  test("keeps catalogue direction metadata in the presentation layer", () => {
    const directional = LIGHTING_EFFECTS.filter((effect) => effect.directions.length > 0).map(
      (effect) => effect.protocolId,
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

describe("configForEffect", () => {
  const base = {
    mode: LightingMode.Rolling,
    color: { red: 1, green: 2, blue: 3 },
    rainbow: true,
    brightness: 5 as const,
    speed: 3 as const,
    direction: LightingDirection.Right,
  };

  test("keeps settings the effect supports", () => {
    expect(configForEffect(base)).toEqual(base);
  });

  test("drops a direction and palette chosen for another effect", () => {
    // Spectrum Cycle has a fixed palette and no direction control.
    expect(configForEffect({ ...base, mode: LightingMode.SpectrumCycle })).toMatchObject({
      rainbow: false,
      direction: LightingDirection.Left,
    });
  });

  test("moves to the effect's first direction when the current one is unavailable", () => {
    // Scrolling offers Up and Down only.
    expect(configForEffect({ ...base, mode: LightingMode.Scrolling }).direction).toBe(
      LightingDirection.Up,
    );
  });
});
