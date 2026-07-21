import { describe, expect, test } from "vitest";
import { CUSTOM_LED_COUNT } from "../../protocol/custom-lighting";
import { AK820_KEY_GROUPS } from "../keyboard-layout";
import { CUSTOM_LIGHTING_PRESETS } from "../presets";

describe("custom RGB presets", () => {
  test.each(CUSTOM_LIGHTING_PRESETS)("$name produces a complete valid table", ({ create }) => {
    const colors = create();
    expect(colors).toHaveLength(CUSTOM_LED_COUNT);
    for (const color of colors) {
      expect(
        Object.values(color).every(
          (value) => Number.isInteger(value) && value >= 0 && value <= 255,
        ),
      ).toBe(true);
    }
  });

  test("WASD accent uses the verified LED group", () => {
    const colors = CUSTOM_LIGHTING_PRESETS.find(
      (preset) => preset.name === "WASD accent",
    )?.create();
    expect(colors).toBeTruthy();
    expect(new Set(AK820_KEY_GROUPS.WASD.map((id) => JSON.stringify(colors?.[id]))).size).toBe(1);
    expect(colors?.[AK820_KEY_GROUPS.WASD[0]]).not.toEqual(colors?.[0]);
  });
});
