import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DeviceController } from "../device/types";
import { applyCustomLighting } from "../lighting/custom";
import { setLighting, setLightingSleepTime, syncTime, uploadImage } from "../operations";
import { RGB565_FRAME_BYTES } from "../protocol/constants";
import type {
  LightingConfig,
  LightingDirection,
  LightingLevel,
  LightingMode,
} from "../protocol/lighting";
import type { LightingSleepTime } from "../protocol/lighting-sleep";

/**
 * Golden record of exactly what goes over USB for every operation: each
 * 64-byte feature packet in hex (as the wire sees it, report ID 0 then the
 * payload), a hash of each 4096-byte image chunk, and where acknowledgement
 * reads happen. Any protocol change must update this fixture deliberately:
 *
 *   UPDATE_GOLDEN=1 npx vitest run src/__tests__/wire-golden.test.ts
 */
const FIXTURE = join(__dirname, "fixtures", "wire-golden.json");

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

function recorder(log: string[]): DeviceController {
  return {
    isConnected: () => true,
    connect: async () => {},
    disconnect: async () => {},
    onDisconnect: () => () => {},
    clearPendingDataInputReports: () => log.push("clear-acks"),
    sendFeatureReport: async (packet) => {
      log.push(`feature ${hex(packet)}`);
    },
    sendReport: async (bytes) => {
      log.push(
        `output ${bytes.length}B sha256:${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}`,
      );
    },
    receiveFeatureReport: async () => {
      log.push("read-feature");
      return null;
    },
    waitForDataInputReport: async () => {
      log.push("wait-ack");
      return new DataView(Uint8Array.of(0x01, 0x5a, 0x02, 0x00).buffer);
    },
  };
}

async function record(run: (ctrl: DeviceController) => Promise<void>): Promise<string[]> {
  const log: string[] = [];
  const done = run(recorder(log));
  await vi.runAllTimersAsync();
  await done;
  return log;
}

const frame = (seed: number) =>
  Uint8Array.from({ length: RGB565_FRAME_BYTES }, (_, i) => (i * 7 + seed) & 0xff);

async function scenarios(): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  out["time 2026-05-16 14:30:45"] = await record((c) =>
    syncTime(c, new Date(2026, 4, 16, 14, 30, 45)),
  );
  for (let mode = 0; mode <= 19; mode++) {
    const config: LightingConfig = {
      mode: mode as LightingMode,
      color: { red: 0x12, green: 0x34, blue: 0x56 },
      rainbow: mode % 2 === 0,
      brightness: ((mode % 5) + 1) as LightingLevel,
      speed: (((mode + 2) % 5) + 1) as LightingLevel,
      direction: (mode % 4) as LightingDirection,
    };
    out[`lighting mode ${mode}`] = await record((c) => setLighting(c, config));
  }
  for (let sleep = 0; sleep <= 3; sleep++) {
    out[`sleep ${sleep}`] = await record((c) =>
      setLightingSleepTime(c, sleep as LightingSleepTime),
    );
  }
  out["image still"] = await record((c) =>
    uploadImage(c, [frame(1)], undefined, { onProgress: () => {} }),
  );
  out["image animation"] = await record((c) =>
    uploadImage(c, [frame(2), frame(3), frame(4)], [100, 2, 510], { onProgress: () => {} }),
  );
  const colors = Array.from({ length: 128 }, (_, i) => ({
    red: i,
    green: 255 - i,
    blue: (i * 3) & 0xff,
  }));
  out["custom rgb"] = await record((c) => applyCustomLighting(c, colors));
  return out;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("every operation produces the recorded USB transaction", async () => {
  const actual = await scenarios();
  if (process.env.UPDATE_GOLDEN || !existsSync(FIXTURE)) {
    writeFileSync(FIXTURE, `${JSON.stringify(actual, null, 1)}\n`);
  }
  expect(actual).toEqual(JSON.parse(readFileSync(FIXTURE, "utf8")));
});
