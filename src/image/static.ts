import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../protocol/constants";
import {
  calculateContainRect,
  containsTransparency,
  fillContainPadding,
  findDominantColor,
  flattenTransparencyOntoBlack,
} from "./resize";
import { rgb888ToRgb565 } from "./rgb565";

const SUPPORTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

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
    ![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (byte, index) => bytes[index] === byte,
    )
  ) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

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
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue;
    if (offset + 2 > bytes.length) return null;
    const segmentLength = view.getUint16(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (
      ((marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)) &&
      segmentLength >= 7
    ) {
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
  if (
    kind === "VP8 " &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  }
  return null;
}

export function inspectStaticImageDimensions(
  bytes: Uint8Array,
  mimeType: string,
): ImageDimensions {
  const dimensions =
    mimeType === "image/png"
      ? readPngDimensions(bytes)
      : mimeType === "image/jpeg"
        ? readJpegDimensions(bytes)
        : mimeType === "image/webp"
          ? readWebpDimensions(bytes)
          : null;
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    throw new Error("processStaticImage: invalid or unsupported image header");
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
      `processStaticImage: source dimensions ${width}×${height} exceed the safe decode limit`,
    );
  }
}

export async function processStaticImage(file: File): Promise<Uint8Array> {
  if (!SUPPORTED_TYPES.has(file.type)) {
    throw new Error(`processStaticImage: unsupported MIME type ${file.type}`);
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `processStaticImage: file too large (${file.size} bytes, max ${MAX_FILE_SIZE})`,
    );
  }

  validateSourceDimensions(
    inspectStaticImageDimensions(new Uint8Array(await file.arrayBuffer()), file.type),
  );

  const bitmap = await createImageBitmap(file);
  try {
    const canvas = new OffscreenCanvas(SCREEN_WIDTH, SCREEN_HEIGHT);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("processStaticImage: 2D context unavailable");
    }

    const sw = (bitmap as unknown as { width: number }).width;
    const sh = (bitmap as unknown as { height: number }).height;
    const rect = calculateContainRect(sw, sh, SCREEN_WIDTH, SCREEN_HEIGHT);
    (ctx as unknown as CanvasRenderingContext2D).drawImage(
      bitmap as unknown as CanvasImageSource,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );

    const imageData = (ctx as unknown as CanvasRenderingContext2D).getImageData(
      0,
      0,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
    );
    if (containsTransparency(imageData.data, SCREEN_WIDTH, SCREEN_HEIGHT, rect)) {
      flattenTransparencyOntoBlack(imageData.data);
    } else {
      const dominantColor = findDominantColor(imageData.data, SCREEN_WIDTH, SCREEN_HEIGHT, rect);
      fillContainPadding(imageData.data, SCREEN_WIDTH, SCREEN_HEIGHT, rect, dominantColor);
    }
    return rgb888ToRgb565(imageData.data, SCREEN_WIDTH, SCREEN_HEIGHT, "le");
  } finally {
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
  }
}
