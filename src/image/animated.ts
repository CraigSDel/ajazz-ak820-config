import { MAX_TFT_FRAMES, SCREEN_HEIGHT, SCREEN_WIDTH } from "../protocol/constants";
import { containResize, type RgbColor } from "./resize";
import { rgb888ToRgb565 } from "./rgb565";

export type AnimatedImage = {
  frames: Uint8Array[];
  delaysMs: number[];
};

// Bounds checked from the file header before anything is decoded, so a
// hostile file can't make the browser allocate huge frames.
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_DIMENSION = 2048;

type WebPInfo = {
  animated: boolean;
  width?: number;
  height?: number;
  frameCount: number;
};

/** The subset of WebCodecs `ImageDecoder` this module uses. */
type BrowserImageDecoder = {
  completed: Promise<void>;
  tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null };
  decode(options: { frameIndex: number }): Promise<{
    image: CanvasImageSource & {
      displayWidth: number;
      displayHeight: number;
      duration: number | null;
      close(): void;
    };
  }>;
  close(): void;
};

type BrowserImageDecoderConstructor = new (options: {
  data: ArrayBuffer;
  type: string;
}) => BrowserImageDecoder;

/** Inspect the WebP RIFF container without decoding its potentially large pixels. */
export function inspectWebP(data: ArrayBuffer): WebPInfo {
  const bytes = new Uint8Array(data);
  const view = new DataView(data);
  const fourCc = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (bytes.length < 12 || fourCc(0) !== "RIFF" || fourCc(8) !== "WEBP") {
    throw new Error("This isn't a valid WebP file.");
  }

  let animated = false;
  let frameCount = 0;
  let width: number | undefined;
  let height: number | undefined;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const kind = fourCc(offset);
    const size = view.getUint32(offset + 4, true);
    const payload = offset + 8;
    if (payload + size > bytes.length) {
      throw new Error("This WebP file is truncated or damaged.");
    }
    if (kind === "VP8X" && size >= 10) {
      animated ||= (bytes[payload] & 0x02) !== 0;
      width = 1 + bytes[payload + 4] + (bytes[payload + 5] << 8) + (bytes[payload + 6] << 16);
      height = 1 + bytes[payload + 7] + (bytes[payload + 8] << 8) + (bytes[payload + 9] << 16);
    } else if (kind === "ANIM") {
      animated = true;
    } else if (kind === "ANMF") {
      animated = true;
      frameCount++;
    }
    offset = payload + size + (size & 1);
  }
  return { animated, width, height, frameCount };
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function assertFileSize(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File is too large (${megabytes(file.size)}); animated images can be up to ${megabytes(MAX_FILE_SIZE)}.`,
    );
  }
}

function assertDimensions(width: number, height: number): void {
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new Error(
      `Animation is ${width} × ${height} px; animated images can be at most ${MAX_DIMENSION} px on each side.`,
    );
  }
}

function assertFrameCount(frameCount: number): void {
  if (frameCount === 0) throw new Error("The animation has no frames.");
  if (frameCount > MAX_TFT_FRAMES) {
    throw new Error(
      `The animation has ${frameCount} frames; the keyboard supports at most ${MAX_TFT_FRAMES}.`,
    );
  }
}

export async function isAnimatedWebP(file: File): Promise<boolean> {
  if (file.type !== "image/webp") return false;
  assertFileSize(file);
  return inspectWebP(await file.arrayBuffer()).animated;
}

/** Logical-screen size from the GIF header (bytes 6–9, little endian). */
function readGifDimensions(bytes: Uint8Array): { width: number; height: number } {
  const signature = String.fromCharCode(...bytes.subarray(0, 6));
  if (bytes.length < 10 || (signature !== "GIF87a" && signature !== "GIF89a")) {
    throw new Error("This isn't a valid GIF file.");
  }
  return { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) };
}

/**
 * Decode an animated GIF or WebP with the browser's WebCodecs ImageDecoder,
 * which composites every frame (transparency and disposal included), then
 * fit each frame to the panel. The letterbox colour is chosen from the first
 * frame and reused so borders don't flicker.
 */
export async function processAnimatedImage(file: File): Promise<AnimatedImage> {
  if (file.type !== "image/gif" && file.type !== "image/webp") {
    throw new Error(
      `Expected an animated GIF or WebP image, not ${file.type || "an unknown type"}.`,
    );
  }
  assertFileSize(file);
  const data = await file.arrayBuffer();

  if (file.type === "image/webp") {
    const info = inspectWebP(data);
    if (!info.animated) throw new Error("This WebP image is not animated.");
    assertDimensions(info.width ?? 0, info.height ?? 0);
    assertFrameCount(info.frameCount);
  } else {
    const { width, height } = readGifDimensions(new Uint8Array(data));
    assertDimensions(width, height);
  }

  const ImageDecoderClass = (
    globalThis as unknown as { ImageDecoder?: BrowserImageDecoderConstructor }
  ).ImageDecoder;
  if (!ImageDecoderClass) {
    throw new Error(
      "Animated images need a browser with the WebCodecs ImageDecoder API. Use a current Chrome or Edge.",
    );
  }

  const decoder = new ImageDecoderClass({ data, type: file.type });
  const frames: Uint8Array[] = [];
  const delaysMs: number[] = [];
  let padding: RgbColor | undefined;
  try {
    // Frame counts are final once the whole (in-memory) file has been parsed.
    await decoder.tracks.ready;
    await decoder.completed;
    const frameCount = decoder.tracks.selectedTrack?.frameCount ?? 0;
    assertFrameCount(frameCount);

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const { image } = await decoder.decode({ frameIndex });
      try {
        const width = image.displayWidth;
        const height = image.displayHeight;
        assertDimensions(width, height);
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | null;
        if (!ctx) throw new Error("This browser could not create a drawing surface.");
        ctx.drawImage(image, 0, 0);
        const rgba = ctx.getImageData(0, 0, width, height).data;
        const resized = containResize(rgba, width, height, SCREEN_WIDTH, SCREEN_HEIGHT, padding);
        padding = resized.padding;
        frames.push(
          rgb888ToRgb565(resized.rgba, SCREEN_WIDTH, SCREEN_HEIGHT, "le", { dither: true }),
        );
        // Durations are in microseconds. Like browsers, play delays of
        // 10 ms or less (common in GIFs) at 100 ms.
        const ms = (image.duration ?? 0) / 1000;
        delaysMs.push(ms > 10 ? ms : 100);
      } finally {
        image.close();
      }
    }
  } finally {
    decoder.close();
  }
  return { frames, delaysMs };
}
