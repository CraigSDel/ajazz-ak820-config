import { describe, expect, test } from "vitest";
import { MockDeviceController } from "../../device/mock-controller";
import { applyCustomLighting, buildCustomLightingReports, canUseCustomLighting } from "../custom";

describe("custom lighting operations", () => {
  test("uses the connected AK820 Pro feature interface", async () => {
    const controller = new MockDeviceController();
    expect(canUseCustomLighting(controller)).toBe(false);
    await controller.connect();
    expect(canUseCustomLighting(controller)).toBe(true);

    await applyCustomLighting(controller, []);
    expect(controller.sent).toHaveLength(10);
    expect(controller.sent.every((report) => report.kind === "feature")).toBe(true);
  });

  test("matches the captured setup, device IDs, RGB blocks, and commit", () => {
    const colors = Array.from({ length: 109 }, () => ({ red: 0, green: 0, blue: 0 }));
    colors[0] = { red: 0x12, green: 0x34, blue: 0x56 };
    colors[106] = { red: 0xaa, green: 0xbb, blue: 0xcc };

    const reports = buildCustomLightingReports(colors);
    expect(reports).toHaveLength(10);
    expect([reports[0].reportId, ...reports[0].bytes.slice(0, 8)]).toEqual([
      0x04, 0x20, 0, 0, 0, 0, 0, 0, 8,
    ]);
    expect([reports[1].reportId, ...reports[1].bytes.slice(0, 7)]).toEqual([
      0x01, 0x12, 0x34, 0x56, 0x02, 0, 0, 0,
    ]);
    expect([reports[1].bytes[51], ...reports[1].bytes.slice(52, 55)]).toEqual([
      0x77, 0xaa, 0xbb, 0xcc,
    ]);
    expect(reports[7].bytes.every((value) => value === 0)).toBe(true);
    expect(reports[8].bytes.every((value) => value === 0)).toBe(true);
    expect([reports[9].reportId, reports[9].bytes[0]]).toEqual([0x04, 0x02]);
  });
});
