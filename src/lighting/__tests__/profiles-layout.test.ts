import { describe, expect, test } from "vitest";
import { CUSTOM_LED_COUNT } from "../../protocol/custom-lighting";
import { AK820_KEY_GROUPS, AK820_LIGHTING_KEYS } from "../keyboard-layout";
import { parseLightingProfile, serializeLightingProfile } from "../profiles";

describe("official AK820 LED layout", () => {
  test("has unique, bounded LED IDs and known groups", () => {
    const ids = AK820_LIGHTING_KEYS.map((key) => key.ledId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.max(...ids)).toBeLessThan(CUSTOM_LED_COUNT);
    expect(AK820_KEY_GROUPS.WASD).toEqual([34, 49, 50, 35]);
    expect(AK820_KEY_GROUPS.Arrows).toEqual([88, 89, 90, 91]);
  });
});

describe("custom RGB profile format", () => {
  const colors = Array.from({ length: CUSTOM_LED_COUNT }, () => ({ red: 1, green: 2, blue: 3 }));

  test("round-trips a versioned profile", () => {
    expect(parseLightingProfile(serializeLightingProfile("My layout", colors))).toEqual({
      version: 1,
      name: "My layout",
      colors,
    });
  });

  test("rejects malformed and incorrectly sized profiles", () => {
    expect(() => parseLightingProfile("not json")).toThrow(/invalid/i);
    expect(() =>
      parseLightingProfile(JSON.stringify({ version: 1, name: "x", colors: [] })),
    ).toThrow(/128/);
  });
});
