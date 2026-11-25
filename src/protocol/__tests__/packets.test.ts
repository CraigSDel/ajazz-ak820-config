import { describe, expect, test } from "vitest";
import { buildImageCfgPacket, buildImageSavePacket, buildImageStartPacket } from "../image";
import {
  buildLightingDataPacket,
  buildLightingPackets,
  type LightingConfig,
  LightingDirection,
  LightingMode,
} from "../lighting";
import { buildLightingSleepPackets, LightingSleepTime } from "../lighting-sleep";
import { PACKET_LENGTH } from "../packet";
import { buildTimeSyncPackets } from "../time";

/**
 * Expectations are written as the wire bytes in docs/protocol-notes.md:
 * "<offset>:<hex>" pairs on an otherwise zero 64-byte packet.
 */
function expectPacket(packet: Uint8Array, nonZero: Record<number, number>) {
  expect(packet).toHaveLength(PACKET_LENGTH);
  const expected = new Uint8Array(PACKET_LENGTH);
  for (const [offset, value] of Object.entries(nonZero)) expected[Number(offset)] = value;
  expect(Buffer.from(packet).toString("hex")).toBe(Buffer.from(expected).toString("hex"));
}

const CONFIG: LightingConfig = {
  mode: LightingMode.Rolling,
  color: { red: 0x12, green: 0x34, blue: 0x56 },
  rainbow: true,
  brightness: 5,
  speed: 3,
  direction: LightingDirection.Right,
};

describe("time sync", () => {
  test("matches the documented 2026-05-16 14:30:45 example", () => {
    const [start, time, data, save] = buildTimeSyncPackets(new Date(2026, 4, 16, 14, 30, 45));
    expectPacket(start, { 0: 0x04, 1: 0x18, 8: 0x01 });
    expectPacket(time, { 0: 0x04, 1: 0x28, 8: 0x01 });
    expectPacket(data, {
      1: 0x01,
      2: 0x5a,
      3: 0x1a,
      4: 0x05,
      5: 0x10,
      6: 0x0e,
      7: 0x1e,
      8: 0x2d,
      10: 0x04,
      62: 0xaa,
      63: 0x55,
    });
    expectPacket(save, { 0: 0x04, 1: 0x02 });
  });

  test("rejects an invalid date", () => {
    expect(() => buildTimeSyncPackets(new Date("not a date"))).toThrow(/invalid date/i);
  });
});

describe("lighting", () => {
  test("wraps MODE_DATA in START, MODE and FINISH with the enable flag at offset 8", () => {
    const [start, mode, , finish] = buildLightingPackets(CONFIG);
    expectPacket(start, { 0: 0x04, 1: 0x18, 8: 0x01 });
    expectPacket(mode, { 0: 0x04, 1: 0x13, 8: 0x01 });
    expectPacket(finish, { 0: 0x04, 1: 0xf0, 8: 0x01 });
  });

  test("encodes mode, colour, palette, levels, direction and the AA55 delimiter", () => {
    expectPacket(buildLightingDataPacket(CONFIG), {
      0: 0x0b,
      1: 0x12,
      2: 0x34,
      3: 0x56,
      8: 1,
      9: 5,
      10: 3,
      11: 3,
      14: 0x55,
      15: 0xaa,
    });
  });

  test("sends Off with its raw ID and both levels zero", () => {
    const packet = buildLightingDataPacket({ ...CONFIG, mode: LightingMode.Off });
    expect([packet[0], packet[9], packet[10]]).toEqual([0, 0, 0]);
  });

  test.each([
    ["brightness", 6],
    ["brightness", 1.5],
    ["speed", -1],
  ] as const)("rejects %s %s", (field, value) => {
    expect(() => buildLightingDataPacket({ ...CONFIG, [field]: value } as LightingConfig)).toThrow(
      new RegExp(field),
    );
  });

  test("rejects out-of-range colours, modes and directions", () => {
    expect(() =>
      buildLightingDataPacket({ ...CONFIG, color: { red: 256, green: 0, blue: 0 } }),
    ).toThrow(/\[0, 255\]/);
    expect(() => buildLightingDataPacket({ ...CONFIG, mode: 0x14 as LightingMode })).toThrow(
      /mode/,
    );
    expect(() => buildLightingDataPacket({ ...CONFIG, direction: 4 as LightingDirection })).toThrow(
      /direction/,
    );
  });
});

describe("lighting sleep", () => {
  test.each(Object.values(LightingSleepTime))("encodes timeout %i at offset 8", (sleepTime) => {
    const [start, sleep, data] = buildLightingSleepPackets(sleepTime);
    expectPacket(start, { 0: 0x04, 1: 0x18, 8: 0x01 });
    expectPacket(sleep, { 0: 0x04, 1: 0x17, 2: 0x01, 8: 0x01 });
    expectPacket(data, { 8: sleepTime, 62: 0xaa, 63: 0x55 });
  });

  test("rejects unknown timeouts", () => {
    expect(() => buildLightingSleepPackets(4 as LightingSleepTime)).toThrow(/sleep time/);
  });
});

describe("image control packets", () => {
  test("uses the AKS075 framing: START without enable flag, CFG sub 3, SAVE", () => {
    expectPacket(buildImageStartPacket(), { 0: 0x04, 1: 0x18 });
    expectPacket(buildImageCfgPacket(0x0123), { 0: 0x04, 1: 0x72, 2: 0x03, 8: 0x23, 9: 0x01 });
    expectPacket(buildImageSavePacket(), { 0: 0x04, 1: 0x02 });
  });

  test("rejects chunk counts outside uint16", () => {
    expect(() => buildImageCfgPacket(0)).toThrow(/chunk count/i);
    expect(() => buildImageCfgPacket(0x10000)).toThrow(/chunk count/i);
  });
});
