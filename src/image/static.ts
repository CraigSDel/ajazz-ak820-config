import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../protocol/constants";
import { containResize } from "./resize";
import { rgb888ToRgb565 } from "./rgb565";

// Bound input to keep a single bad file from OOM-crashing the tab. A 10 MB
// PNG can already decompress to several hundred MB of RGBA; anything larger
// is almost certainly a screenshot or a decompression bomb rather than
// something intended for a 128×128 TFT.
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_SOURCE_DIMENSION = 8192;
const MAX_SOURCE_PIXELS = 16_777_216;

type ImageDimensions = { width: number; height: number };

function readPngDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (
    bytes.length < 24 ||
    ![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)
  ) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/**
 * SOF0–SOF15 hold the frame size. C4 (Huffman tables), C8 (reserved) and CC
 * (arithmetic coding) share the range but aren't frame headers.
 */
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

/** Walk the JPEG segments until a start-of-frame header, which holds the size. */
function readJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    // Start-of-image, end-of-image and TEM markers carry no length.
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue;
    if (offset + 2 > bytes.length) return null;
    const segmentLength = view.getUint16(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (isStartOfFrame(marker) && segmentLength >= 7) {
      return { height: view.getUint16(offset + 3), width: view.getUint16(offset + 5) };
    }
    offset += segmentLength;
  }
  return null;
}

function readWebpDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (
    bytes.length < 30 ||
    String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF" ||
    String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP"
  ) {
    return null;
  }
  const kind = String.fromCharCode(...bytes.slice(12, 16));
  if (kind === "VP8X") {
    return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    };
  }
  if (kind === "VP8L" && bytes[20] === 0x2f) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
  }
  if (kind === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  }
  return null;
}

const DIMENSION_READERS: Record<string, (bytes: Uint8Array) => ImageDimensions | null> = {
  "image/png": readPngDimensions,
  "image/jpeg": readJpegDimensions,
  "image/webp": readWebpDimensions,
};

/** Read an image's size from its file header, before committing to decoding it. */
export function inspectStaticImageDimensions(bytes: Uint8Array, mimeType: string): ImageDimensions {
  const dimensions = DIMENSION_READERS[mimeType]?.(bytes) ?? null;
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    throw new Error("The file is damaged or isn't a supported image.");
  }
  return dimensions;
}

function validateSourceDimensions({ width, height }: ImageDimensions): void {
  if (
    width > MAX_SOURCE_DIMENSION ||
    height > MAX_SOURCE_DIMENSION ||
    width * height > MAX_SOURCE_PIXELS
  ) {
    throw new Error(
      `Image is ${width} × ${height} px, beyond the safe decode limit of ${MAX_SOURCE_DIMENSION} px per side and ${MAX_SOURCE_PIXELS / 1_000_000} megapixels.`,
    );
  }
}

export async function processStaticImage(file: File): Promise<Uint8Array> {
  if (!(file.type in DIMENSION_READERS)) {
    throw new Error("Unsupported image type. Choose a PNG, JPEG, WebP or GIF image.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB); still images can be up to ${MAX_FILE_SIZE / (1024 * 1024)} MB.`,
    );
  }

  validateSourceDimensions(
    inspectStaticImageDimensions(new Uint8Array(await file.arrayBuffer()), file.type),
  );

  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = bitmap;
    // Decode at native size and share the animated path's resampler so
    // stills and animations are scaled, padded and dithered identically.
    const context = new OffscreenCanvas(width, height).getContext("2d");
    if (!context) throw new Error("This browser could not create a drawing surface.");
    context.drawImage(bitmap, 0, 0);
    const source = context.getImageData(0, 0, width, height).data;
    const { rgba } = containResize(source, width, height, SCREEN_WIDTH, SCREEN_HEIGHT);
    return rgb888ToRgb565(rgba, SCREEN_WIDTH, SCREEN_HEIGHT, "le", { dither: true });
  } finally {
    // The test environment's bitmap polyfill has no close().
    bitmap.close?.();
  }
}
