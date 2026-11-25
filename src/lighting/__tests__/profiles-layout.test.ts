import { describe, expect, test } from "vitest";
import { CUSTOM_LED_COUNT } from "../../protocol/constants";
import { AK820_LIGHTING_KEYS } from "../keyboard-layout";

describe("official AK820 LED layout", () => {
  test("has 81 unique key IDs within the custom-lighting table", () => {
    const ids = AK820_LIGHTING_KEYS.map((key) => key.id);
    expect(ids).toHaveLength(81);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.max(...ids)).toBeLessThan(CUSTOM_LED_COUNT);
  });
});
