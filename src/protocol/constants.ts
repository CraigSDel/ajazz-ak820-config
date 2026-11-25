// Values sourced from docs/protocol-notes.md.

/** USB Vendor ID — Microdia/Sonix (the OEM HID chip). */
export const AJAZZ_VENDOR_ID = 0x0c45;

/**
 * Confirmed wired identity of the original AK820 Pro with the 128x128 TFT.
 * Sonix reuses nearby product IDs across unrelated keyboards, so additional
 * IDs require an AK820 Pro-specific descriptor or USB capture before inclusion.
 */
export const AK820_PRO_PRODUCT_IDS: readonly number[] = [0x8009] as const;

/** TFT screen dimensions. */
export const SCREEN_WIDTH = 128;
export const SCREEN_HEIGHT = 128;
export const RGB565_FRAME_BYTES = SCREEN_WIDTH * SCREEN_HEIGHT * 2;

/** Maximum frame count representable by the legacy TFT upload header. */
export const MAX_TFT_FRAMES = 255;

/**
 * Image data chunk size for OUT transfers on the data interface.
 * gohv uses 4123 bytes (with a trailing 27-byte short packet at USB
 * level). WebHID rejected 4123 on this hardware — the data interface's
 * HID descriptor doesn't allow that report size. Falling back to 4096
 * (a multiple of the 64-byte USB packet size) and accepting we cannot
 * generate the short-packet boundary that gohv relies on.
 */
export const CHUNK_SIZE = 4096;

/**
 * Longest per-frame delay the upload header can express: one byte holding
 * the delay in 2 ms units. Longer holds are made by repeating the frame.
 */
export const MAX_FRAME_DELAY_MS = 255 * 2;

/** Size of the per-key colour table used by the custom-lighting editor. */
export const CUSTOM_LED_COUNT = 128;

/** HID usage pages used to disambiguate the AJAZZ vendor interfaces under WebHID. */
export const CONTROL_USAGE_PAGE = 0xff13;
export const DATA_USAGE_PAGE = 0xff68;
