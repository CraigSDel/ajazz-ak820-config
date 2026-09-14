import { describe, expect, test } from "vitest";
import { LightingMode } from "../../protocol/lighting";
import { effectForMode, LIGHTING_EFFECTS } from "../effects";

describe("AK820 lighting effect metadata", () => {
  test("covers off plus every protocol effect ID exactly once", () => {
    expect(LIGHTING_EFFECTS.map((effect) => effect.protocolId)).toEqual(
      Array.from({ length: 20 }, (_, protocolId) => protocolId),
    );
  });

  test("keeps human-facing labels separate from protocol identifiers", () => {
    expect(effectForMode(LightingMode.Effect1)).toMatchObject({
      protocolId: 1,
      displayName: "Static",
      animation: { id: "steady" },
    });
    expect(effectForMode(LightingMode.Effect15)).toMatchObject({
      protocolId: 15,
      displayName: "Ripples",
      animation: { id: "ripple" },
    });
  });

  test("defines a complete, distinct provisional animation profile for every effect", () => {
    const profiles = LIGHTING_EFFECTS.filter(
      ({ protocolId }) => protocolId !== LightingMode.Off,
    ).map(({ animation }) => animation);

    expect(new Set(profiles.map(({ id }) => id)).size).toBe(19);
    for (const profile of profiles) {
      expect(profile.speedSeconds).toHaveLength(5);
      expect(profile.speedSeconds.every((duration) => duration > 0)).toBe(true);
      expect(profile.calibrated).toBe(false);
      expect(profile.spatial).toBeTruthy();
      expect(profile.envelope).toBeTruthy();
    }
  });

  test("models the Outward effect as radial propagation from the keyboard center", () => {
    expect(effectForMode(LightingMode.Effect9).animation).toMatchObject({
      id: "fountain",
      spatial: "radial",
      propagation: "radial",
    });
  });

  test("fixed-palette effects do not advertise custom colors", () => {
    expect(effectForMode(LightingMode.Effect6).supportsColor).toBe(false);
    expect(effectForMode(LightingMode.Effect8).supportsColor).toBe(false);
  });

  test("offers the palette switch for the provisional steady effect", () => {
    expect(effectForMode(LightingMode.Effect1).supportsPalette).toBe(true);
  });

  test("keeps catalogue direction metadata in the presentation layer", () => {
    const directional = LIGHTING_EFFECTS.filter((effect) => effect.directions.length > 0).map(
      (effect) => effect.protocolId,
    );
    expect(directional).toEqual([
      LightingMode.Effect10,
      LightingMode.Effect11,
      LightingMode.Effect12,
      LightingMode.Effect16,
      LightingMode.Effect18,
    ]);
  });
});
