/**
 * Control-channel packets are 64-byte feature reports. The AK820 Pro declares
 * no HID report IDs, so every packet is sent with report ID 0 and the bytes
 * below are exactly what crosses the wire. Offsets match the tables in
 * docs/protocol-notes.md (offset 0 is the first byte of the packet).
 */
export type Packet = Uint8Array;

export const PACKET_LENGTH = 64;

/** First byte of every command packet. */
export const COMMAND_PREFIX = 0x04;

export const Command = {
  Save: 0x02,
  Mode: 0x13,
  Sleep: 0x17,
  Start: 0x18,
  CustomTable: 0x20,
  Time: 0x28,
  Image: 0x72,
  Finish: 0xf0,
} as const;

/** Offset of the enable flag (or count) byte in a command packet. */
const FLAG_OFFSET = 8;

/** `04 <command> <sub> 00 00 00 00 00 <flag> 00 …` */
export function commandPacket(command: number, { sub = 0, flag = 0 } = {}): Packet {
  const packet = new Uint8Array(PACKET_LENGTH);
  packet[0] = COMMAND_PREFIX;
  packet[1] = command;
  packet[2] = sub;
  packet[FLAG_OFFSET] = flag;
  return packet;
}

/** Time and sleep data packets end with `AA 55` at offsets 62–63. */
export function dataPacket(fields: Record<number, number>): Packet {
  const packet = new Uint8Array(PACKET_LENGTH);
  for (const [offset, value] of Object.entries(fields)) packet[Number(offset)] = value;
  packet[62] = 0xaa;
  packet[63] = 0x55;
  return packet;
}

export const isCommandPacket = (packet: Packet) => packet[0] === COMMAND_PREFIX;
