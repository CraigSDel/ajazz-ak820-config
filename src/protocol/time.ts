import { Command, commandPacket, dataPacket, type Packet } from "./packet";

/** START → TIME → TIME_DATA → SAVE (docs/protocol-notes.md, "Time sync"). */
export function buildTimeSyncPackets(date: Date): Packet[] {
  if (Number.isNaN(date.getTime())) {
    throw new Error("buildTimeSyncPackets: invalid date");
  }
  const data = dataPacket({
    0: 0x00,
    1: 0x01,
    2: 0x5a, // time marker
    3: date.getFullYear() - 2000,
    4: date.getMonth() + 1,
    5: date.getDate(),
    6: date.getHours(),
    7: date.getMinutes(),
    8: date.getSeconds(),
    10: 0x04,
  });
  return [
    commandPacket(Command.Start, { flag: 1 }),
    commandPacket(Command.Time, { flag: 1 }),
    data,
    commandPacket(Command.Save),
  ];
}
