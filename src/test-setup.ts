import {
  type Canvas,
  createCanvas,
  type Image,
  loadImage,
  type CanvasRenderingContext2D as NodeCRC,
} from "canvas";
import { decompressFrames, parseGIF } from "gifuct-js";
import { beforeEach } from "vitest";

// Node exposes an incomplete experimental localStorage global in some versions.
// Provide the Storage subset used by the application for deterministic tests.
const storageValues = new Map<string, string>();
const testStorage: Storage = {
  get length() {
    return storageValues.size;
  },
  clear: () => storageValues.clear(),
  getItem: (key) => storageValues.get(key) ?? null,
  key: (index) => [...storageValues.keys()][index] ?? null,
  removeItem: (key) => storageValues.delete(key),
  setItem: (key, value) => storageValues.set(key, String(value)),
};
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: testStorage });
Object.defineProperty(window, "localStorage", { configurable: true, value: testStorage });
// Saved preferences (last-sent lighting, auto time sync) must not leak between tests.
beforeEach(() => storageValues.clear());

class OffscreenCanvasPolyfill {
  width: number;
  height: number;
  private canvas: Canvas;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.canvas = createCanvas(width, height);
  }
  getContext(contextId: "2d") {
    if (contextId !== "2d") return null;
    return this.canvas.getContext("2d") as unknown as NodeCRC;
  }
}

(globalThis as unknown as { OffscreenCanvas: typeof OffscreenCanvasPolyfill }).OffscreenCanvas =
  OffscreenCanvasPolyfill;

// jsdom's Blob/File don't implement arrayBuffer().
// jsdom wraps Blob data behind a Symbol("impl") property whose ._buffer holds the raw Buffer.
// Patch Blob.prototype.arrayBuffer to reach through that internal symbol.
if (!globalThis.Blob.prototype.arrayBuffer) {
  globalThis.Blob.prototype.arrayBuffer = async function (): Promise<ArrayBuffer> {
    // Find the jsdom impl symbol (there is exactly one Symbol key on jsdom objects)
    const syms = Object.getOwnPropertySymbols(this) as symbol[];
    for (const sym of syms) {
      const impl = (this as unknown as Record<symbol, unknown>)[sym] as Record<
        string,
        unknown
      > | null;
      if (impl && typeof impl === "object" && impl._buffer instanceof Buffer) {
        const nodeBuf: Buffer = impl._buffer as Buffer;
        // Copy into a plain ArrayBuffer so callers get a detached view
        const ab = new ArrayBuffer(nodeBuf.byteLength);
        new Uint8Array(ab).set(new Uint8Array(nodeBuf));
        return ab;
      }
    }
    return new ArrayBuffer(0);
  };
}

(
  globalThis as unknown as {
    createImageBitmap: (source: Blob) => Promise<Image>;
  }
).createImageBitmap = async (source: Blob): Promise<Image> => {
  const buf = Buffer.from(await source.arrayBuffer());
  return await loadImage(buf);
};

/**
 * Minimal stand-in for WebCodecs ImageDecoder (GIF only) so the animated
 * pipeline can run under jsdom. Chrome's real decoder handles disposal; this
 * test double only composites opaque patch pixels, which the fixtures need.
 */
class GifImageDecoderPolyfill {
  completed = Promise.resolve();
  tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } };
  private readonly frames: { canvas: Canvas; durationUs: number }[] = [];

  constructor({ data, type }: { data: ArrayBuffer; type: string }) {
    if (type !== "image/gif") throw new Error(`Test ImageDecoder only supports GIF, not ${type}`);
    const gif = parseGIF(data);
    const { width, height } = gif.lsd;
    const composite = new Uint8ClampedArray(width * height * 4);
    for (const frame of decompressFrames(gif, true)) {
      const { left, top, width: w, height: h } = frame.dims;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const src = (y * w + x) * 4;
          if (frame.patch[src + 3] === 0) continue;
          composite.set(frame.patch.subarray(src, src + 4), ((top + y) * width + left + x) * 4);
        }
      }
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");
      const image = ctx.createImageData(width, height);
      image.data.set(composite);
      ctx.putImageData(image, 0, 0);
      this.frames.push({ canvas, durationUs: frame.delay * 1000 });
    }
    this.tracks = { ready: Promise.resolve(), selectedTrack: { frameCount: this.frames.length } };
  }

  async decode({ frameIndex }: { frameIndex: number }) {
    const { canvas, durationUs } = this.frames[frameIndex];
    return {
      image: Object.assign(canvas, {
        displayWidth: canvas.width,
        displayHeight: canvas.height,
        duration: durationUs,
        close() {},
      }),
    };
  }

  close() {}
}

if (!("ImageDecoder" in globalThis)) {
  Object.defineProperty(globalThis, "ImageDecoder", {
    configurable: true,
    value: GifImageDecoderPolyfill,
  });
}
