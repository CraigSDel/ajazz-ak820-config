import { describe, expect, test } from "vitest";
import {
  AJAZZ_VENDOR_ID,
  AK820_PRO_PRODUCT_IDS,
  CHUNK_SIZE,
  CONTROL_USAGE_PAGE,
  RGB565_FRAME_BYTES,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from "../constants";

describe("protocol constants", () => {
  test("vendor ID is Microdia/Sonix (0x0C45)", () => {
    expect(AJAZZ_VENDOR_ID).toBe(0x0c45);
  });

  test("only includes the hardware-confirmed original AK820 Pro PID", () => {
    expect(AK820_PRO_PRODUCT_IDS).toEqual([0x8009]);
  });

  test("screen is 128x128", () => {
    expect(SCREEN_WIDTH).toBe(128);
    expect(SCREEN_HEIGHT).toBe(128);
  });

  test("RGB565 frame bytes = 32768", () => {
    expect(RGB565_FRAME_BYTES).toBe(128 * 128 * 2);
  });

  test("chunk size is 4096 (WebHID rejected 4123)", () => {
    expect(CHUNK_SIZE).toBe(4096);
  });

  test("control usage page is 0xFF13", () => {
    expect(CONTROL_USAGE_PAGE).toBe(0xff13);
  });
});
