import { Command, commandPacket, dataPacket, type Packet } from "./packet";

export const LightingSleepTime = {
  Never: 0,
  OneMinute: 1,
  FiveMinutes: 2,
  ThirtyMinutes: 3,
} as const;

export type LightingSleepTime = (typeof LightingSleepTime)[keyof typeof LightingSleepTime];

/** START → SLEEP (sub 1) → SLEEP_DATA; no SAVE or FINISH. */
export function buildLightingSleepPackets(sleepTime: LightingSleepTime): Packet[] {
  if (
    !Number.isInteger(sleepTime) ||
    sleepTime < LightingSleepTime.Never ||
    sleepTime > LightingSleepTime.ThirtyMinutes
  ) {
    throw new Error(`buildLightingSleepPackets: invalid sleep time ${sleepTime}`);
  }
  return [
    commandPacket(Command.Start, { flag: 1 }),
    commandPacket(Command.Sleep, { sub: 1, flag: 1 }),
    dataPacket({ 8: sleepTime }),
  ];
}
