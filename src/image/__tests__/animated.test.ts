import { createCanvas } from "canvas";
import GIFEncoder from "gif-encoder-2";
import { describe, expect, test } from "vitest";
import { RGB565_FRAME_BYTES } from "../../protocol/constants";
import { inspectWebP, isAnimatedWebP, processAnimatedImage } from "../animated";

function makeThreeFrameGif(): Uint8Array {
  const width = 200;
  const height = 100;
  const encoder = new GIFEncoder(width, height);
  encoder.start();
  encoder.setRepeat(0); // loop forever
  encoder.setDelay(100); // 100 ms per frame
  // Frame 0 — red
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgb(255,0,0)";
  ctx.fillRect(0, 0, width, height);
  encoder.addFrame(ctx);
  // Frame 1 — green
  ctx.fillStyle = "rgb(0,255,0)";
  ctx.fillRect(0, 0, width, height);
  encoder.addFrame(ctx);
  // Frame 2 — blue
  ctx.fillStyle = "rgb(0,0,255)";
  ctx.fillRect(0, 0, width, height);
  encoder.addFrame(ctx);
  encoder.finish();
  return new Uint8Array(encoder.out.getData());
}

function makeWebPContainer(animated: boolean, frameCount = 0): Uint8Array {
  const chunks: Array<{ kind: string; payload: Uint8Array }> = [];
  const vp8x = new Uint8Array(10);
  if (animated) vp8x[0] = 0x02;
  vp8x[4] = 1; // width = 2 (24-bit value stores width - 1)
  vp8x[7] = 1; // height = 2
  chunks.push({ kind: "VP8X", payload: vp8x });
  if (animated) {
    chunks.push({ kind: "ANIM", payload: new Uint8Array(6) });
    for (let i = 0; i < frameCount; i++) {
      chunks.push({ kind: "ANMF", payload: new Uint8Array(16) });
    }
  }
  const size = 12 + chunks.reduce((sum, chunk) => sum + 8 + chunk.payload.length, 0);
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
  };
  write(0, "RIFF");
  view.setUint32(4, size - 8, true);
  write(8, "WEBP");
  let offset = 12;
  for (const chunk of chunks) {
    write(offset, chunk.kind);
    view.setUint32(offset + 4, chunk.payload.length, true);
    bytes.set(chunk.payload, offset + 8);
    offset += 8 + chunk.payload.length;
  }
  return bytes;
}

describe("processAnimatedImage", () => {
  test("3-frame R/G/B GIF → 3 frames, each 32768 bytes, ~100 ms delays", async () => {
    const gifBytes = makeThreeFrameGif();
    const file = new File([gifBytes], "rgb.gif", { type: "image/gif" });

    const out = await processAnimatedImage(file);

    expect(out.frames).toHaveLength(3);
    for (const frame of out.frames) {
      expect(frame.byteLength).toBe(RGB565_FRAME_BYTES);
    }
    expect(out.delaysMs).toHaveLength(3);
    for (const ms of out.delaysMs) {
      // GIFs encode delays in 1/100 second units, so 100ms requested may
      // round-trip to anywhere in 90-110ms. Be lenient.
      expect(ms).toBeGreaterThanOrEqual(80);
      expect(ms).toBeLessThanOrEqual(120);
    }
  });

  test("each frame is predominantly its expected color (RGB565)", async () => {
    const gifBytes = makeThreeFrameGif();
    const file = new File([gifBytes], "rgb.gif", { type: "image/gif" });

    const out = await processAnimatedImage(file);

    // Helper: read RGB565 little-endian at byte offset i*2.
    const pickColor = (frame: Uint8Array, i: number) => {
      const lo = frame[i * 2];
      const hi = frame[i * 2 + 1];
      const v = (hi << 8) | lo;
      return {
        r: (v >> 11) & 0x1f,
        g: (v >> 5) & 0x3f,
        b: v & 0x1f,
      };
    };

    // Center pixel of each frame.
    const centerIdx = 128 * 64 + 64;
    const c0 = pickColor(out.frames[0], centerIdx);
    const c1 = pickColor(out.frames[1], centerIdx);
    const c2 = pickColor(out.frames[2], centerIdx);

    // GIF quantization may shift colors slightly; check dominance.
    expect(c0.r).toBeGreaterThan(c0.g);
    expect(c0.r).toBeGreaterThan(c0.b);
    expect(c1.g).toBeGreaterThan(c1.r);
    expect(c1.g).toBeGreaterThan(c1.b);
    expect(c2.b).toBeGreaterThan(c2.r);
    expect(c2.b).toBeGreaterThan(c2.g);
  });

  test("rejects MIME types other than GIF and WebP", async () => {
    const file = new File([new Uint8Array(10)], "bad.png", { type: "image/png" });
    await expect(processAnimatedImage(file)).rejects.toThrow(/gif/i);
  });

  test("rejects files larger than 20 MB", async () => {
    const big = new Uint8Array(21 * 1024 * 1024);
    const file = new File([big], "huge.gif", { type: "image/gif" });
    await expect(processAnimatedImage(file)).rejects.toThrow(/too large/i);
  });

  test("decodes every animated frame, converts microsecond durations, and defaults tiny delays", async () => {
    const webpBytes = makeWebPContainer(true, 2);
    const file = new File([webpBytes], "rgb.webp", { type: "image/webp" });
    const originalDecoder = (globalThis as unknown as { ImageDecoder?: unknown }).ImageDecoder;

    class FakeImageDecoder {
      completed = Promise.resolve();
      tracks = { ready: Promise.resolve(), selectedTrack: { frameCount: 2 } };
      async decode({ frameIndex }: { frameIndex: number }) {
        const canvas = createCanvas(2, 2);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = frameIndex === 0 ? "red" : "blue";
        ctx.fillRect(0, 0, 2, 2);
        return {
          image: Object.assign(canvas, {
            displayWidth: 2,
            displayHeight: 2,
            // Microseconds; 0 is how decoders report a missing GIF delay.
            duration: frameIndex === 0 ? 0 : 120_000,
            close() {},
          }),
        };
      }
      close() {}
    }

    Object.defineProperty(globalThis, "ImageDecoder", {
      configurable: true,
      value: FakeImageDecoder,
    });
    try {
      const out = await processAnimatedImage(file);
      expect(out.frames).toHaveLength(2);
      for (const frame of out.frames) expect(frame.byteLength).toBe(RGB565_FRAME_BYTES);
      // Center pixels retain each decoded frame's color after RGB565 conversion.
      const centerOffset = (128 * 64 + 64) * 2;
      expect((out.frames[0][centerOffset + 1] << 8) | out.frames[0][centerOffset]).toBe(0xf800);
      expect((out.frames[1][centerOffset + 1] << 8) | out.frames[1][centerOffset]).toBe(0x001f);
      expect(out.delaysMs).toEqual([100, 120]);
    } finally {
      Object.defineProperty(globalThis, "ImageDecoder", {
        configurable: true,
        value: originalDecoder,
      });
    }
  });

  test("reports a clear error when animated decoding is unavailable", async () => {
    const file = new File([makeWebPContainer(true, 1)], "animated.webp", {
      type: "image/webp",
    });
    const originalDecoder = (globalThis as unknown as { ImageDecoder?: unknown }).ImageDecoder;
    Object.defineProperty(globalThis, "ImageDecoder", { configurable: true, value: undefined });
    try {
      await expect(processAnimatedImage(file)).rejects.toThrow(/WebCodecs ImageDecoder/i);
      const gif = new File([makeThreeFrameGif()], "rgb.gif", { type: "image/gif" });
      await expect(processAnimatedImage(gif)).rejects.toThrow(/WebCodecs ImageDecoder/i);
    } finally {
      Object.defineProperty(globalThis, "ImageDecoder", {
        configurable: true,
        value: originalDecoder,
      });
    }
  });

  test("rejects animated WebP frame counts above the safety limit before decoding", async () => {
    const file = new File([makeWebPContainer(true, 256)], "too-many.webp", {
      type: "image/webp",
    });
    await expect(processAnimatedImage(file)).rejects.toThrow(
      /256 frames; the keyboard supports at most 255/i,
    );
  });
});

describe("WebP container inspection", () => {
  test("distinguishes static and animated WebP and counts animation frames", async () => {
    const animated = makeWebPContainer(true, 3);
    expect(inspectWebP(animated.buffer)).toEqual({
      animated: true,
      width: 2,
      height: 2,
      frameCount: 3,
    });
    const animatedFile = new File([animated], "animated.webp", { type: "image/webp" });
    expect(await isAnimatedWebP(animatedFile)).toBe(true);
    const staticFile = new File([makeWebPContainer(false)], "still.webp", { type: "image/webp" });
    expect(await isAnimatedWebP(staticFile)).toBe(false);
  });

  test("rejects invalid and truncated WebP containers", () => {
    expect(() => inspectWebP(new ArrayBuffer(12))).toThrow(/valid WebP/i);

    const truncated = makeWebPContainer(true, 1);
    const truncatedView = truncated.slice(0, truncated.length - 1);
    expect(() => inspectWebP(truncatedView.buffer)).toThrow(/truncated/i);
  });
});

describe("GIF header checks", () => {
  test("rejects files that are not GIFs and oversized canvases before decoding", async () => {
    const notGif = new File([new Uint8Array(16)], "fake.gif", { type: "image/gif" });
    await expect(processAnimatedImage(notGif)).rejects.toThrow(/valid GIF/);

    const huge = new Uint8Array(16);
    huge.set([...new TextEncoder().encode("GIF89a"), 0x00, 0x10, 0x10, 0x00]);
    const oversized = new File([huge], "huge.gif", { type: "image/gif" });
    await expect(processAnimatedImage(oversized)).rejects.toThrow(/4096 × 16 px/);
  });
});

describe("animation consistency", () => {
  test("keeps one letterbox colour for every frame of an animation", async () => {
    const width = 32;
    const height = 16;
    const encoder = new GIFEncoder(width, height);
    encoder.start();
    encoder.setDelay(100);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    // The dominant colour flips from red to blue between frames.
    for (const color of ["#ff0000", "#0000ff"]) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);
      encoder.addFrame(ctx as unknown as CanvasRenderingContext2D);
    }
    encoder.finish();
    const file = new File([new Uint8Array(encoder.out.getData())], "flip.gif", {
      type: "image/gif",
    });

    const { frames } = await processAnimatedImage(file);
    const topLeft = (frame: Uint8Array) => frame[0] | (frame[1] << 8);
    // 32×16 contains into 128×64, leaving 32 rows of padding above.
    expect(topLeft(frames[0])).toBe(0xf800);
    expect(topLeft(frames[1])).toBe(topLeft(frames[0]));
  });
});
