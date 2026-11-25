import type { DeviceTransport } from "../device/types";
import type { RGBColor } from "../protocol/lighting";
import { Command, commandPacket, PACKET_LENGTH, type Packet } from "../protocol/packet";
import { AK820_LIGHTING_KEYS } from "./keyboard-layout";

const TABLE_PACKETS = 8;
const RECORDS_PER_PACKET = 16;

/**
 * SETUP (`04 20`, table count at offset 8) → 8 table packets of 16 records
 * `[key ID, red, green, blue]` in layout order → commit (`04 02`), as captured
 * from the OEM driver. Only the first six table packets carry the 81 keys.
 * `colors` is indexed by key ID.
 */
export function buildCustomLightingPackets(colors: readonly RGBColor[]): Packet[] {
  const tables = Array.from({ length: TABLE_PACKETS }, () => new Uint8Array(PACKET_LENGTH));
  AK820_LIGHTING_KEYS.forEach((key, index) => {
    const color = colors[key.id] ?? { red: 0, green: 0, blue: 0 };
    tables[Math.floor(index / RECORDS_PER_PACKET)].set(
      [key.id, color.red, color.green, color.blue],
      (index % RECORDS_PER_PACKET) * 4,
    );
  });
  return [
    commandPacket(Command.CustomTable, { flag: TABLE_PACKETS }),
    ...tables,
    commandPacket(Command.Save),
  ];
}

export async function applyCustomLighting(
  controller: DeviceTransport,
  colors: readonly RGBColor[],
): Promise<void> {
  const packets = buildCustomLightingPackets(colors);
  for (const [index, packet] of packets.entries()) {
    await controller.sendFeatureReport(packet);
    // Acknowledge only the setup and commit packets, as the OEM driver does.
    if (index === 0 || index === packets.length - 1) await controller.receiveFeatureReport();
  }
}
