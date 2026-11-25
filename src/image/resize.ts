export type ContainRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
};

export type RgbColor = readonly [red: number, green: number, blue: number];

type Bounds = Pick<ContainRect, "x" | "y" | "width" | "height">;

/** The whole pixels fully inside `bounds`, clipped to the image. End values are exclusive. */
function pixelRange(bounds: Bounds, width: number, height: number) {
  return {
    startX: Math.max(0, Math.ceil(bounds.x)),
    startY: Math.max(0, Math.ceil(bounds.y)),
    endX: Math.min(width, Math.floor(bounds.x + bounds.width)),
    endY: Math.min(height, Math.floor(bounds.y + bounds.height)),
  };
}

export function calculateContainRect(
  sourceWidth: number,
  sourceHeight: number,
  destinationWidth: number,
  destinationHeight: number,
): ContainRect {
  const scale = Math.min(destinationWidth / sourceWidth, destinationHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (destinationWidth - width) / 2,
    y: (destinationHeight - height) / 2,
    width,
    height,
    scale,
  };
}

/**
 * Finds the dominant visible color using 5-bit RGB buckets, then returns the
 * average original color in the winning bucket. Quantization makes the result
 * stable for JPEGs and other images with small per-pixel color variations.
 */
export function findDominantColor(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  bounds: Bounds = {
    x: 0,
    y: 0,
    width: sourceWidth,
    height: sourceHeight,
  },
): RgbColor {
  // 5 bits per channel, so 32 levels each.
  const bucketCount = 32 * 32 * 32;
  const counts = new Uint32Array(bucketCount);
  const redSums = new Uint32Array(bucketCount);
  const greenSums = new Uint32Array(bucketCount);
  const blueSums = new Uint32Array(bucketCount);
  const { startX, startY, endX, endY } = pixelRange(bounds, sourceWidth, sourceHeight);

  let dominantBucket = 0;
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const offset = (y * sourceWidth + x) * 4;
      // Ignore mostly transparent pixels; they aren't part of the visible image.
      if (source[offset + 3] < 128) continue;
      const red = source[offset];
      const green = source[offset + 1];
      const blue = source[offset + 2];
      const bucket = ((red >> 3) << 10) | ((green >> 3) << 5) | (blue >> 3);
      counts[bucket]++;
      redSums[bucket] += red;
      greenSums[bucket] += green;
      blueSums[bucket] += blue;
      if (counts[bucket] > counts[dominantBucket]) dominantBucket = bucket;
    }
  }

  const count = counts[dominantBucket];
  if (count === 0) return [0, 0, 0];
  return [
    Math.round(redSums[dominantBucket] / count),
    Math.round(greenSums[dominantBucket] / count),
    Math.round(blueSums[dominantBucket] / count),
  ];
}

export function fillContainPadding(
  destination: Uint8ClampedArray,
  destinationWidth: number,
  destinationHeight: number,
  rect: Bounds,
  color: RgbColor,
): void {
  for (let y = 0; y < destinationHeight; y++) {
    for (let x = 0; x < destinationWidth; x++) {
      const centerX = x + 0.5;
      const centerY = y + 0.5;
      if (
        centerX >= rect.x &&
        centerX < rect.x + rect.width &&
        centerY >= rect.y &&
        centerY < rect.y + rect.height
      ) {
        continue;
      }
      const offset = (y * destinationWidth + x) * 4;
      destination[offset] = color[0];
      destination[offset + 1] = color[1];
      destination[offset + 2] = color[2];
      destination[offset + 3] = 255;
    }
  }
}

export function containsTransparency(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  bounds: Bounds = {
    x: 0,
    y: 0,
    width: sourceWidth,
    height: sourceHeight,
  },
): boolean {
  const { startX, startY, endX, endY } = pixelRange(bounds, sourceWidth, sourceHeight);
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      if (source[(y * sourceWidth + x) * 4 + 3] < 255) return true;
    }
  }
  return false;
}

/** RGB565 has no alpha channel, so composite transparent pixels onto black. */
export function flattenTransparencyOntoBlack(source: Uint8ClampedArray): void {
  for (let offset = 0; offset < source.length; offset += 4) {
    const alpha = source[offset + 3];
    source[offset] = Math.round((source[offset] * alpha) / 255);
    source[offset + 1] = Math.round((source[offset + 1] * alpha) / 255);
    source[offset + 2] = Math.round((source[offset + 2] * alpha) / 255);
    source[offset + 3] = 255;
  }
}

const BLACK: RgbColor = [0, 0, 0];

/** Upper bound on samples per axis for each destination pixel when downscaling. */
const MAX_SAMPLES_PER_AXIS = 4;

/**
 * Supersampled contain-resize. Each destination pixel averages an up-to 4×4
 * grid of samples across its source footprint (alpha-weighted, so transparent
 * pixels don't darken edges). Upscaling falls back to nearest-neighbour, which
 * keeps pixel art crisp. The bounded sample count keeps large animations
 * fast: cost is O(destination pixels), independent of source size.
 */
function resampleContain(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  destinationWidth: number,
  destinationHeight: number,
  rect: ContainRect,
): Uint8ClampedArray {
  const destination = new Uint8ClampedArray(destinationWidth * destinationHeight * 4);
  const samples = Math.min(MAX_SAMPLES_PER_AXIS, Math.max(1, Math.ceil(1 / rect.scale)));
  const footprint = 1 / rect.scale;
  const sampleCount = samples * samples;

  for (let y = 0; y < destinationHeight; y++) {
    const centerY = y + 0.5;
    if (centerY < rect.y || centerY >= rect.y + rect.height) continue;
    const sourceTop = (y - rect.y) / rect.scale;

    for (let x = 0; x < destinationWidth; x++) {
      const centerX = x + 0.5;
      if (centerX < rect.x || centerX >= rect.x + rect.width) continue;
      const sourceLeft = (x - rect.x) / rect.scale;

      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      for (let row = 0; row < samples; row++) {
        const sampleY = clampIndex(
          Math.floor(sourceTop + ((row + 0.5) * footprint) / samples),
          sourceHeight,
        );
        for (let column = 0; column < samples; column++) {
          const sampleX = clampIndex(
            Math.floor(sourceLeft + ((column + 0.5) * footprint) / samples),
            sourceWidth,
          );
          const offset = (sampleY * sourceWidth + sampleX) * 4;
          const sampleAlpha = source[offset + 3];
          red += source[offset] * sampleAlpha;
          green += source[offset + 1] * sampleAlpha;
          blue += source[offset + 2] * sampleAlpha;
          alpha += sampleAlpha;
        }
      }

      const destinationOffset = (y * destinationWidth + x) * 4;
      if (alpha > 0) {
        destination[destinationOffset] = Math.round(red / alpha);
        destination[destinationOffset + 1] = Math.round(green / alpha);
        destination[destinationOffset + 2] = Math.round(blue / alpha);
        destination[destinationOffset + 3] = Math.round(alpha / sampleCount);
      }
    }
  }
  return destination;
}

function clampIndex(value: number, length: number): number {
  return value < 0 ? 0 : value >= length ? length - 1 : value;
}

export type ContainResult = {
  rgba: Uint8ClampedArray;
  /** Padding colour that was applied; reuse it to keep animation borders stable. */
  padding: RgbColor;
};

/**
 * Aspect-preserving resize onto an opaque destination. Without an explicit
 * `padding`, images with transparency are padded black (RGB565 has no alpha)
 * and opaque images use their dominant colour.
 */
export function containResize(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  destinationWidth: number,
  destinationHeight: number,
  padding?: RgbColor,
): ContainResult {
  const rect = calculateContainRect(sourceWidth, sourceHeight, destinationWidth, destinationHeight);
  const rgba = resampleContain(
    source,
    sourceWidth,
    sourceHeight,
    destinationWidth,
    destinationHeight,
    rect,
  );
  const chosen =
    padding ??
    (containsTransparency(source, sourceWidth, sourceHeight)
      ? BLACK
      : findDominantColor(rgba, destinationWidth, destinationHeight, rect));
  flattenTransparencyOntoBlack(rgba);
  fillContainPadding(rgba, destinationWidth, destinationHeight, rect, chosen);
  return { rgba, padding: chosen };
}
