import { describe, expect, test } from "vitest";
import { CUSTOM_LED_COUNT } from "../../protocol/constants";
import { AK820_LIGHTING_KEYS } from "../keyboard-layout";

describe("official AK820 LED layout", () => {
  test("has unique, bounded LED IDs", () => {
    const ids = AK820_LIGHTING_KEYS.map((key) => key.ledId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.max(...ids)).toBeLessThan(CUSTOM_LED_COUNT);
  });
});
