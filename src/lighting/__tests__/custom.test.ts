import { describe, expect, test } from "vitest";
import { MockDeviceController } from "../../device/mock-controller";
import { applyCustomLighting, buildCustomLightingPackets } from "../custom";

describe("custom lighting operations", () => {
  test("uses the connected AK820 Pro feature interface", async () => {
    const controller = new MockDeviceController();
    await controller.connect();

    await applyCustomLighting(controller, []);
    expect(controller.sent).toHaveLength(10);
    expect(controller.sent.every((report) => report.kind === "feature")).toBe(true);
  });

  test("matches the captured setup, device IDs, RGB blocks, and commit", () => {
    // Colours are indexed by firmware key ID: Esc is 0x01, Delete 0x77.
    const colors = Array.from({ length: 128 }, () => ({ red: 0, green: 0, blue: 0 }));
    colors[0x01] = { red: 0x12, green: 0x34, blue: 0x56 };
    colors[0x77] = { red: 0xaa, green: 0xbb, blue: 0xcc };

    const packets = buildCustomLightingPackets(colors);
    expect(packets).toHaveLength(10);
    expect([...packets[0].slice(0, 9)]).toEqual([0x04, 0x20, 0, 0, 0, 0, 0, 0, 8]);
    // Records are [device key ID, red, green, blue]; Esc is key 0x01.
    expect([...packets[1].slice(0, 8)]).toEqual([0x01, 0x12, 0x34, 0x56, 0x02, 0, 0, 0]);
    expect([...packets[1].slice(52, 56)]).toEqual([0x77, 0xaa, 0xbb, 0xcc]);
    expect(packets[7].every((value) => value === 0)).toBe(true);
    expect(packets[8].every((value) => value === 0)).toBe(true);
    expect([...packets[9].slice(0, 2)]).toEqual([0x04, 0x02]);
  });
});
