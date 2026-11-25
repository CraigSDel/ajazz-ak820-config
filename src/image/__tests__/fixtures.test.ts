import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { inspectWebP } from "../animated";
import { inspectStaticImageDimensions } from "../static";

// Bundled presets are WebP, which only the browser can decode; the real
// pipeline is exercised in Chrome. These checks pin the shipped bytes and
// confirm each file is already at the panel's native size.
const imagesDirectory = join(process.cwd(), "images");

const baselines: Record<string, { sha256: string; frameCount: number }> = {
  "sunset.webp": {
    sha256: "517e8b26506630918e0d0acbf59b9bca4bf42f33f5f3e954de81e962347e1d9b",
    frameCount: 1,
  },
  "java_duke.webp": {
    sha256: "cef82adfd2e48e9968e322587d14929fdc6e61a10c1171747ed90dc68917270f",
    frameCount: 1,
  },
  "orbit.webp": {
    sha256: "1e10ee1e9d12b08b0abbe9ced04fc4b01e9004dd97c3bb44ab950f2b6491e7ad",
    frameCount: 16,
  },
  "aurora.webp": {
    sha256: "275c2afb9037ffca5800b915d3106f81dd2d70c34318e0c468953fd78d28d34f",
    frameCount: 20,
  },
};

describe("bundled preset images", () => {
  test("every image has a baseline", async () => {
    expect((await readdir(imagesDirectory)).sort()).toEqual(Object.keys(baselines).sort());
  });

  test.each(Object.entries(baselines))("%s", async (name, { sha256, frameCount }) => {
    const bytes = new Uint8Array(await readFile(join(imagesDirectory, name)));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha256);
    if (frameCount === 1) {
      const { width, height } = inspectStaticImageDimensions(bytes, "image/webp");
      expect(Math.max(width, height)).toBe(128);
    } else {
      expect(inspectWebP(bytes.buffer)).toEqual({
        animated: true,
        width: 128,
        height: 128,
        frameCount,
      });
    }
  });
});
