import type { DeviceController } from "../device/types";
import { AK820_LIGHTING_KEYS } from "./keyboard-layout";
import { CONTROL_REPORT_LEAD_BYTE, PACKET_LENGTH } from "../protocol/constants";
import type { RGBColor } from "../protocol/lighting";
import type { ReportMessage } from "../protocol/types";

// Device IDs captured from the AK820 Pro OEM driver's custom-lighting transfer.
// They are ordered like AK820_LIGHTING_KEYS (the visual ANSI layout), not by
// the editor's sparse preview IDs.
const DEVICE_KEY_IDS = [
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x77, 0x13, 0x14,
  0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x67, 0x75, 0x25, 0x26, 0x27,
  0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f, 0x30, 0x31, 0x43, 0x76, 0x37, 0x38, 0x39, 0x3a,
  0x3b, 0x3c, 0x3d, 0x3e, 0x3f, 0x40, 0x41, 0x42, 0x55, 0x79, 0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e,
  0x4f, 0x50, 0x51, 0x52, 0x53, 0x54, 0x65, 0x5b, 0x5c, 0x5d, 0x5e, 0x5f, 0x60, 0x62, 0x63, 0x64,
  0x66,
] as const;

export function canUseCustomLighting(controller: DeviceController): boolean {
  return controller.isConnected();
}

export function buildCustomLightingReports(colors: readonly RGBColor[]): ReportMessage[] {
  const wireReports = Array.from({ length: 8 }, () => new Uint8Array(PACKET_LENGTH));

  AK820_LIGHTING_KEYS.forEach((key, index) => {
    const color = colors[key.ledId] ?? { red: 0, green: 0, blue: 0 };
    const report = wireReports[Math.floor(index / 16)];
    const offset = (index % 16) * 4;
    report.set([DEVICE_KEY_IDS[index], color.red, color.green, color.blue], offset);
  });

  const start = new Uint8Array(PACKET_LENGTH);
  start.set([CONTROL_REPORT_LEAD_BYTE, 0x20], 0);
  start[8] = wireReports.length;
  const commit = new Uint8Array(PACKET_LENGTH);
  commit.set([CONTROL_REPORT_LEAD_BYTE, 0x02], 0);

  return [start, ...wireReports, commit].map(toReportMessage);
}

export async function applyCustomLighting(
  controller: DeviceController,
  colors: readonly RGBColor[],
): Promise<void> {
  if (!canUseCustomLighting(controller)) {
    throw new Error("Custom RGB is unavailable while the keyboard is disconnected.");
  }
  for (const report of buildCustomLightingReports(colors)) {
    await controller.sendFeatureReport(report);
    if (report.reportId === CONTROL_REPORT_LEAD_BYTE) {
      await controller.receiveFeatureReport(0);
    }
  }
}

function toReportMessage(wire: Uint8Array): ReportMessage {
  return { reportId: wire[0], bytes: wire.slice(1) };
}
