import { describe, expect, test } from "vitest";
import { MockDeviceController } from "../device/mock-controller";
import { setLighting, setLightingSleepTime, syncTime, uploadImage } from "../operations";
import { RGB565_FRAME_BYTES } from "../protocol/constants";
import { LightingDirection, LightingMode } from "../protocol/lighting";
import { LightingSleepTime } from "../protocol/lighting-sleep";

const LIGHTING_CONFIG = {
  mode: LightingMode.Static,
  color: { red: 255, green: 0, blue: 0 },
  rainbow: false,
  brightness: 5 as const,
  speed: 2 as const,
  direction: LightingDirection.Left,
};

/** Command byte of each sent packet: `04 <cmd>` packets report <cmd>, data packets their lead byte. */
const commands = (ctrl: MockDeviceController) =>
  ctrl.sent.map(({ bytes }) => (bytes[0] === 0x04 ? bytes[1] : bytes[0]));

describe("syncTime", () => {
  test("sends START, TIME, TIME_DATA, SAVE and reads after TIME and SAVE", async () => {
    const ctrl = new MockDeviceController();
    await ctrl.connect();
    await syncTime(ctrl, new Date("2026-05-16T14:30:45"));
    expect(ctrl.sent.every(({ kind }) => kind === "feature")).toBe(true);
    expect(commands(ctrl)).toEqual([0x18, 0x28, 0x00, 0x02]);
    expect(ctrl.featureReads).toBe(2);
  });

  test("throws on invalid date", async () => {
    const ctrl = new MockDeviceController();
    await ctrl.connect();
    await expect(syncTime(ctrl, new Date("not-a-date"))).rejects.toThrow(/invalid date/i);
  });
});

describe("setLighting", () => {
  test("sends the complete START, MODE, MODE_DATA, FINISH transaction twice", async () => {
    const ctrl = new MockDeviceController();
    await ctrl.connect();

    await setLighting(ctrl, LIGHTING_CONFIG);

    expect(commands(ctrl)).toEqual([0x18, 0x13, 0x01, 0xf0, 0x18, 0x13, 0x01, 0xf0]);
    // Reads after the three command packets only; Static's MODE_DATA commits without one.
    expect(ctrl.featureReads).toBe(6);
  });

  test.each([
    LightingMode.Glittering,
    LightingMode.Breath,
    LightingMode.Outward,
    LightingMode.Rolling,
    LightingMode.Explode,
  ])("acknowledges MODE_DATA for hardware-verified mode %i", async (mode) => {
    const ctrl = new MockDeviceController();
    await ctrl.connect();
    await setLighting(ctrl, { ...LIGHTING_CONFIG, mode });
    expect(ctrl.featureReads).toBe(8);
  });

  test("does not acknowledge MODE_DATA for modes that commit without it", async () => {
    const ctrl = new MockDeviceController();
    await ctrl.connect();
    await setLighting(ctrl, { ...LIGHTING_CONFIG, mode: LightingMode.Rotating });
    expect(ctrl.featureReads).toBe(6);
  });

  test("stops the transaction and exposes a transfer failure", async () => {
    const ctrl = new MockDeviceController({ failSendAt: 3 });
    await ctrl.connect();

    await expect(setLighting(ctrl, LIGHTING_CONFIG)).rejects.toMatchObject({
      name: "DeviceFailure",
      error: { kind: "transfer-failed", command: LightingMode.Static },
    });
    expect(ctrl.sent).toHaveLength(2);
  });
});

describe("setLightingSleepTime", () => {
  test("sends START, SLEEP and data, reading only after the command packets", async () => {
    const ctrl = new MockDeviceController();
    await ctrl.connect();

    await setLightingSleepTime(ctrl, LightingSleepTime.FiveMinutes);

    expect(commands(ctrl)).toEqual([0x18, 0x17, 0x00]);
    expect(ctrl.sent[2].bytes[8]).toBe(LightingSleepTime.FiveMinutes);
    expect(ctrl.featureReads).toBe(2);
  });
});

const uploadStaticImage = (
  ctrl: MockDeviceController,
  frame: Uint8Array,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
) => uploadImage(ctrl, [frame], undefined, { onProgress, signal });

const uploadAnimatedImage = (
  ctrl: MockDeviceController,
  frames: Uint8Array[],
  delaysMs: number[],
  onProgress: (fraction: number) => void,
) => uploadImage(ctrl, frames, delaysMs, { onProgress });

describe("uploadImage: single still", () => {
  test("sends START + CFG + 9 chunks of 4096 + SAVE", async () => {
    const ctrl = new MockDeviceController();
    await ctrl.connect();
    const buf = new Uint8Array(RGB565_FRAME_BYTES);
    const progress: number[] = [];

    await uploadStaticImage(ctrl, buf, (p) => progress.push(p));

    // 9 chunks of 4096 bytes per frame.
    // Sequence: START + CFG + 9 chunks + SAVE = 12 reports.
    expect(ctrl.sent).toHaveLength(12);

    expect(ctrl.sent[0].kind).toBe("feature");
    expect(ctrl.sent[1].kind).toBe("feature");
    expect(ctrl.sent[0].bytes[8]).toBe(0x00); // START without enable flag
    expect(ctrl.sent[1].bytes[2]).toBe(0x03); // IMAGE_CFG sub-command
    for (let i = 0; i < 9; i++) {
      expect(ctrl.sent[2 + i].kind).toBe("output");
      expect(ctrl.sent[2 + i].bytes.byteLength).toBe(4096);
    }
    expect(ctrl.sent[2].bytes[0]).toBe(0x01);
    expect(ctrl.sent[2].bytes[1]).toBe(0x00);
    expect(ctrl.sent[2].bytes[2]).toBe(0xff);
    expect(ctrl.sent[11].kind).toBe("feature");
    expect(commands(ctrl)[11]).toBe(0x02);

    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(1);
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1]);
    }
  });

  test("rejects wrong-sized buffer", async () => {
    const ctrl = new MockDeviceController();
    await ctrl.connect();
    await expect(uploadStaticImage(ctrl, new Uint8Array(100), () => {})).rejects.toThrow(/32768/);
  });

  test("aborts before SAVE when a data chunk is not acknowledged", async () => {
    const ctrl = new MockDeviceController({ dataAckResponds: false });
    await ctrl.connect();

    await expect(
      uploadStaticImage(ctrl, new Uint8Array(RGB565_FRAME_BYTES), () => {}),
    ).rejects.toMatchObject({ error: { kind: "ack-timeout", chunkIndex: 0 } });

    expect(ctrl.sent).toHaveLength(3);
    expect(ctrl.sent.at(-1)?.kind).toBe("output");
  });

  test("stops before the next chunk and never sends SAVE when cancelled", async () => {
    const ctrl = new MockDeviceController();
    await ctrl.connect();
    const abort = new AbortController();

    await expect(
      uploadStaticImage(
        ctrl,
        new Uint8Array(RGB565_FRAME_BYTES),
        (fraction) => {
          if (fraction > 0) abort.abort();
        },
        abort.signal,
      ),
    ).rejects.toMatchObject({ error: { kind: "cancelled" } });

    // START + CFG + exactly one chunk, then nothing.
    expect(ctrl.sent).toHaveLength(3);
    expect(ctrl.sent.at(-1)?.kind).toBe("output");
  });

  test("does not touch the keyboard when cancelled before starting", async () => {
    const ctrl = new MockDeviceController();
    await ctrl.connect();
    const abort = new AbortController();
    abort.abort();

    await expect(
      uploadStaticImage(ctrl, new Uint8Array(RGB565_FRAME_BYTES), () => {}, abort.signal),
    ).rejects.toMatchObject({ error: { kind: "cancelled" } });
    expect(ctrl.sent).toHaveLength(0);
  });
});

describe("uploadImage: animation (AKS075 path)", () => {
  test("3 frames → 25 chunks (with 256-byte header) + START + CFG + SAVE", async () => {
    const ctrl = new MockDeviceController();
    await ctrl.connect();
    const frames = [
      new Uint8Array(RGB565_FRAME_BYTES),
      new Uint8Array(RGB565_FRAME_BYTES),
      new Uint8Array(RGB565_FRAME_BYTES),
    ];
    const delaysMs = [100, 100, 100];
    const progress: number[] = [];

    await uploadAnimatedImage(ctrl, frames, delaysMs, (p) => progress.push(p));

    // AKS075 framing: 256 (header) + 3 * 32768 = 98560 → ceil/4096 = 25 chunks.
    // Sequence: START + CFG + 25 chunks + SAVE = 28 reports.
    expect(ctrl.sent).toHaveLength(28);
    // CFG uses sub-command 0x03 (AKS075) at offset 2.
    expect(ctrl.sent[1].bytes[2]).toBe(0x03);
    // Final packet is SAVE (0x02), not FINISH (0xF0).
    expect(commands(ctrl)[27]).toBe(0x02);
    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(1);
  });

  test("rejects mismatched frames/delays length", async () => {
    const ctrl = new MockDeviceController();
    await ctrl.connect();
    const frames = [new Uint8Array(RGB565_FRAME_BYTES)];
    await expect(uploadAnimatedImage(ctrl, frames, [100, 200], () => {})).rejects.toThrow(/delay/i);
  });
});
