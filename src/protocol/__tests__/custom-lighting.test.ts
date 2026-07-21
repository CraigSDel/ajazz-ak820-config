import { describe, expect, test } from "vitest";
import {
  buildCommandPackets,
  buildCustomLedTable,
  buildCustomModeData,
  buildLedEffectData,
  CUSTOM_LED_TABLE_BYTES,
  parseCommandResponse,
  parseCustomLedTable,
  SET_CUSTOM_LED_COMMAND,
} from "../custom-lighting";
import { LightingDirection, LightingMode } from "../lighting";

describe("official framed command transport", () => {
  test("chunks a 512-byte custom table with addresses and a final flag", () => {
    const data = new Uint8Array(CUSTOM_LED_TABLE_BYTES).map((_, index) => index & 0xff);
    const packets = buildCommandPackets(
      { command: SET_CUSTOM_LED_COMMAND, contentSize: data.length, data },
      64,
    );
    expect(packets).toHaveLength(10);
    expect([...packets[0].slice(0, 8)]).toEqual([0xaa, 0x24, 56, 0, 0, 0, 0, 0]);
    expect([...(packets.at(-1)?.slice(0, 8) ?? [])]).toEqual([0xaa, 0x24, 8, 248, 1, 0, 1, 0]);
    expect(packets[0].slice(8)).toEqual(data.slice(0, 56));
  });

  test("parses the official response header", () => {
    const response = new Uint8Array(16);
    response.set([0x55, 0x24, 8, 0x38, 0x01]);
    expect(parseCommandResponse(response)).toMatchObject({ command: 0x24, address: 0x0138 });
  });
});

describe("custom per-key RGB payload", () => {
  test("encodes and decodes 128 indexed RGB entries", () => {
    const table = buildCustomLedTable([
      { red: 255, green: 1, blue: 2 },
      { red: 3, green: 254, blue: 4 },
    ]);
    expect(table).toHaveLength(512);
    expect([...table.slice(0, 8)]).toEqual([0, 255, 1, 2, 1, 3, 254, 4]);
    expect(parseCustomLedTable(table).slice(0, 2)).toEqual([
      { ledId: 0, red: 255, green: 1, blue: 2 },
      { ledId: 1, red: 3, green: 254, blue: 4 },
    ]);
  });

  test("builds custom mode 128 using the official 16-byte payload", () => {
    const data = buildCustomModeData(6);
    expect(data[0]).toBe(128);
    expect(data[4]).toBe(255);
    expect(data[9]).toBe(6);
    expect([...data.slice(14)]).toEqual([0xaa, 0x55]);
  });
});

describe("built-in RGB effect payload", () => {
  test("matches the official 16-byte SET_LED_EFFECT layout", () => {
    const data = buildLedEffectData({
      mode: LightingMode.Rolling,
      color: { red: 0x12, green: 0x34, blue: 0x56 },
      rainbow: true,
      brightness: 6,
      speed: 6,
      direction: LightingDirection.Right,
    });

    expect([...data]).toEqual([
      LightingMode.Rolling,
      0x12,
      0x34,
      0x56,
      0xff,
      0,
      0,
      0,
      1,
      6,
      6,
      LightingDirection.Right,
      0,
      0,
      0xaa,
      0x55,
    ]);
  });
});
