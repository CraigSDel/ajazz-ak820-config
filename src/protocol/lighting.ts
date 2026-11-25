import { Command, commandPacket, PACKET_LENGTH, type Packet } from "./packet";

/**
 * Built-in lighting effects, by the number the firmware uses for each. Names
 * follow the OEM driver's effect list; the user-facing names, descriptions and
 * capabilities live in `lighting/effects.ts`.
 */
export const LightingMode = {
  Off: 0x00,
  Static: 0x01,
  SingleKeyOn: 0x02,
  SingleKeyOff: 0x03,
  Glittering: 0x04,
  Falling: 0x05,
  Colourful: 0x06,
  Breath: 0x07,
  SpectrumCycle: 0x08,
  Outward: 0x09,
  Scrolling: 0x0a,
  Rolling: 0x0b,
  Rotating: 0x0c,
  Explode: 0x0d,
  Launch: 0x0e,
  Ripples: 0x0f,
  Flowing: 0x10,
  Pulsating: 0x11,
  Tilt: 0x12,
  Shuttle: 0x13,
} as const;

export type LightingMode = (typeof LightingMode)[keyof typeof LightingMode];

export const LightingDirection = {
  Left: 0,
  Down: 1,
  Up: 2,
  Right: 3,
} as const;

export type LightingDirection = (typeof LightingDirection)[keyof typeof LightingDirection];

/** Firmware preset level. 0 is only sent for Off; the UI exposes 1–5. */
export type LightingLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type RGBColor = {
  red: number;
  green: number;
  blue: number;
};

export type LightingConfig = {
  mode: LightingMode;
  color: RGBColor;
  rainbow: boolean;
  brightness: LightingLevel;
  speed: LightingLevel;
  direction: LightingDirection;
};

const MAX_LEVEL = 5;

/** Byte offsets in the MODE_DATA packet (docs/protocol-notes.md, "RGB lighting mode"). */
const ModeDataOffset = {
  Mode: 0,
  Red: 1,
  Green: 2,
  Blue: 3,
  Rainbow: 8,
  Brightness: 9,
  Speed: 10,
  Direction: 11,
  /** Two-byte `0xAA55` end marker, stored little endian. */
  EndMarker: 14,
} as const;

/** Position of MODE_DATA in the packets `buildLightingPackets` returns. */
export const MODE_DATA_PACKET_INDEX = 2;

/**
 * START → MODE → MODE_DATA → FINISH (docs/protocol-notes.md, "RGB lighting
 * mode"). MODE_DATA's first byte is the mode itself.
 */
export function buildLightingPackets(config: LightingConfig): Packet[] {
  return [
    commandPacket(Command.Start, { flag: 1 }),
    commandPacket(Command.Mode, { flag: 1 }),
    buildLightingDataPacket(config),
    commandPacket(Command.Finish, { flag: 1 }),
  ];
}

export function buildLightingDataPacket(config: LightingConfig): Packet {
  validateMode(config.mode);
  validateColor(config.color);
  validateLevel("brightness", config.brightness);
  validateLevel("speed", config.speed);
  validateDirection(config.direction);

  // Off always sends brightness and speed 0, whatever the sliders say.
  const off = config.mode === LightingMode.Off;
  const packet = new Uint8Array(PACKET_LENGTH);
  packet[ModeDataOffset.Mode] = config.mode;
  packet[ModeDataOffset.Red] = config.color.red;
  packet[ModeDataOffset.Green] = config.color.green;
  packet[ModeDataOffset.Blue] = config.color.blue;
  packet[ModeDataOffset.Rainbow] = config.rainbow ? 1 : 0;
  packet[ModeDataOffset.Brightness] = off ? 0 : config.brightness;
  packet[ModeDataOffset.Speed] = off ? 0 : config.speed;
  packet[ModeDataOffset.Direction] = config.direction;
  packet[ModeDataOffset.EndMarker] = 0x55;
  packet[ModeDataOffset.EndMarker + 1] = 0xaa;
  return packet;
}

function validateMode(mode: LightingMode): void {
  if (!Number.isInteger(mode) || mode < LightingMode.Off || mode > LightingMode.Shuttle) {
    throw new Error(`buildLightingDataPacket: invalid lighting mode ${mode}`);
  }
}

function validateColor(color: RGBColor): void {
  for (const [name, value] of Object.entries(color)) {
    if (!Number.isInteger(value) || value < 0 || value > 0xff) {
      throw new Error(`buildLightingDataPacket: ${name} must be an integer in [0, 255]`);
    }
  }
}

function validateLevel(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_LEVEL) {
    throw new Error(`buildLightingDataPacket: ${name} must be an integer in [0, 5]`);
  }
}

function validateDirection(direction: LightingDirection): void {
  if (
    !Number.isInteger(direction) ||
    direction < LightingDirection.Left ||
    direction > LightingDirection.Right
  ) {
    throw new Error(`buildLightingDataPacket: invalid lighting direction ${direction}`);
  }
}
