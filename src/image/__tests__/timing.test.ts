import { describe, expect, test } from "vitest";
import { MAX_FRAME_DELAY_MS } from "../../protocol/constants";
import { fitFrameTiming } from "../timing";

const frame = (id: number) => Uint8Array.of(id);

describe("fitFrameTiming", () => {
  test("leaves delays the header can express untouched", () => {
    const result = fitFrameTiming([frame(1), frame(2)], [100, MAX_FRAME_DELAY_MS]);
    expect(result.delaysMs).toEqual([100, MAX_FRAME_DELAY_MS]);
    expect(result.frames).toHaveLength(2);
    expect(result.extendedFrames).toBe(0);
  });

  test("repeats a long frame so its total hold time is preserved", () => {
    const result = fitFrameTiming([frame(1), frame(2)], [1000, 50]);
    expect(result.frames.map((f) => f[0])).toEqual([1, 1, 2]);
    expect(result.delaysMs).toEqual([500, 500, 50]);
    expect(result.delaysMs.slice(0, 2).reduce((a, b) => a + b)).toBe(1000);
    expect(result.extendedFrames).toBe(1);
    expect(result.shortenedFrames).toBe(0);
  });

  test("shortens long frames instead of exceeding the frame limit", () => {
    const result = fitFrameTiming([frame(1), frame(2)], [2000, 2000], 5);
    // 2000 ms needs 4 copies (3 extra); the budget of 3 covers only the first.
    expect(result.frames).toHaveLength(5);
    expect(result.extendedFrames).toBe(1);
    expect(result.shortenedFrames).toBe(1);
    expect(result.delaysMs.at(-1)).toBe(MAX_FRAME_DELAY_MS);
  });
});
