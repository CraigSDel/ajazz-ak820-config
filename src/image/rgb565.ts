export type Endianness = "le" | "be";

export type Rgb565Options = {
  /**
   * Apply 4×4 ordered (Bayer) dithering before truncating to 5/6/5 bits.
   * Ordered dithering is position-stable, so animations don't shimmer, and
   * colours that are already exactly representable stay perfectly flat.
   */
  dither?: boolean;
};

// Bayer thresholds scaled to [0, 1): (m + 0.5) / 16.
const BAYER_4X4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  (value) => (value + 0.5) / 16,
);

export function rgb888ToRgb565(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  endian: Endianness,
  { dither = false }: Rgb565Options = {},
): Uint8Array {
  const pixelCount = width * height;
  if (rgba.length !== pixelCount * 4) {
    throw new Error(
      `rgb888ToRgb565: rgba length ${rgba.length} does not match ${width}x${height}*4`,
    );
  }
  const out = new Uint8Array(pixelCount * 2);
  for (let pixel = 0; pixel < pixelCount; pixel++) {
    let red = rgba[pixel * 4];
    let green = rgba[pixel * 4 + 1];
    let blue = rgba[pixel * 4 + 2];
    if (dither) {
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const threshold = BAYER_4X4[(y & 3) * 4 + (x & 3)];
      // 5-bit channels quantise in steps of 8, the 6-bit green channel in 4.
      red = Math.min(255, red + threshold * 8);
      green = Math.min(255, green + threshold * 4);
      blue = Math.min(255, blue + threshold * 8);
    }
    // 5 bits of red, 6 of green, 5 of blue: RRRRRGGG GGGBBBBB.
    const value = ((red & 0xf8) << 8) | ((green & 0xfc) << 3) | (blue >> 3);
    const high = (value >> 8) & 0xff;
    const low = value & 0xff;
    out[pixel * 2] = endian === "le" ? low : high;
    out[pixel * 2 + 1] = endian === "le" ? high : low;
  }
  return out;
}

/**
 * Expand little-endian RGB565 back to opaque RGBA, as the keyboard will show
 * it, for the on-screen preview. Writes into `rgba`, which holds 4 bytes per pixel.
 */
export function rgb565ToRgba(rgb565: Uint8Array, rgba: Uint8ClampedArray): void {
  for (let pixel = 0; pixel < rgb565.length / 2; pixel++) {
    const value = rgb565[pixel * 2] | (rgb565[pixel * 2 + 1] << 8);
    rgba[pixel * 4] = ((value >> 11) & 0x1f) << 3;
    rgba[pixel * 4 + 1] = ((value >> 5) & 0x3f) << 2;
    rgba[pixel * 4 + 2] = (value & 0x1f) << 3;
    rgba[pixel * 4 + 3] = 255;
  }
}
