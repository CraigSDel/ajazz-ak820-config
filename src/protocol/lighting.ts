import { CONTROL_REPORT_LEAD_BYTE, PACKET_LENGTH } from "./constants";
import type { ReportMessage } from "./types";

export const LightingMode = {
  Off: 0x00,
  Effect1: 0x01,
  Effect2: 0x02,
  Effect3: 0x03,
  Effect4: 0x04,
  Effect5: 0x05,
  Effect6: 0x06,
  Effect7: 0x07,
  Effect8: 0x08,
  Effect9: 0x09,
  Effect10: 0x0a,
  Effect11: 0x0b,
  Effect12: 0x0c,
  Effect13: 0x0d,
  Effect14: 0x0e,
  Effect15: 0x0f,
  Effect16: 0x10,
  Effect17: 0x11,
  Effect18: 0x12,
  Effect19: 0x13,
} as const;

export type LightingMode = (typeof LightingMode)[keyof typeof LightingMode];

export const LightingDirection = {
  Left: 0,
  Down: 1,
  Up: 2,
  Right: 3,
} as const;

export type LightingDirection = (typeof LightingDirection)[keyof typeof LightingDirection];

/** Superset of optional command levels (1-6) and feature/off level 0. */
export type LightingLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

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

const CMD_MODE = 0x13;
const CMD_START = 0x18;
const CMD_FINISH = 0xf0;
const ENABLE_FLAG_BYTE_INDEX = 7;
const PAYLOAD_LENGTH = PACKET_LENGTH - 1;
const MAX_LEVEL = 5;
const DELIMITER_LOW = 0x55;
const DELIMITER_HIGH = 0xaa;

export function buildLightingModePreambleReport(): ReportMessage {
  const bytes = new Uint8Array(PAYLOAD_LENGTH);
  bytes[0] = CMD_MODE;
  bytes[ENABLE_FLAG_BYTE_INDEX] = 0x01;
  return { reportId: CONTROL_REPORT_LEAD_BYTE, bytes };
}

export function buildLightingStartReport(): ReportMessage {
  return buildLightingControlReport(CMD_START);
}

export function buildLightingFinishReport(): ReportMessage {
  return buildLightingControlReport(CMD_FINISH);
}

export function buildLightingDataReport(config: LightingConfig): ReportMessage {
  validateMode(config.mode);
  validateColor(config.color);
  validateLevel("brightness", config.brightness);
  validateLevel("speed", config.speed);
  validateDirection(config.direction);

  const effectiveMode = effectiveLightingMode(config.mode);
  const bytes = new Uint8Array(PAYLOAD_LENGTH);
  bytes[0] = config.color.red;
  bytes[1] = config.color.green;
  bytes[2] = config.color.blue;
  bytes[7] = config.rainbow ? 1 : 0;
  bytes[8] = config.mode === LightingMode.Off ? 0 : config.brightness;
  bytes[9] =
    config.mode === LightingMode.Off || config.mode === LightingMode.Effect1 ? 0 : config.speed;
  bytes[10] = config.direction;
  bytes[13] = DELIMITER_LOW;
  bytes[14] = DELIMITER_HIGH;

  return { reportId: effectiveMode, bytes };
}

function effectiveLightingMode(mode: LightingMode): LightingMode {
  if (mode === LightingMode.Off) return LightingMode.Effect2;
  if (mode === LightingMode.Effect1) return LightingMode.Effect7;
  return mode;
}

function buildLightingControlReport(command: number): ReportMessage {
  const bytes = new Uint8Array(PAYLOAD_LENGTH);
  bytes[0] = command;
  bytes[ENABLE_FLAG_BYTE_INDEX] = 0x01;
  return { reportId: CONTROL_REPORT_LEAD_BYTE, bytes };
}

function validateMode(mode: LightingMode): void {
  if (!Number.isInteger(mode) || mode < LightingMode.Off || mode > LightingMode.Effect19) {
    throw new Error(`buildLightingDataReport: invalid lighting mode ${mode}`);
  }
}

function validateColor(color: RGBColor): void {
  for (const [name, value] of Object.entries(color)) {
    if (!Number.isInteger(value) || value < 0 || value > 0xff) {
      throw new Error(`buildLightingDataReport: ${name} must be an integer in [0, 255]`);
    }
  }
}

function validateLevel(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_LEVEL) {
    throw new Error(`buildLightingDataReport: ${name} must be an integer in [0, 5]`);
  }
}

function validateDirection(direction: LightingDirection): void {
  if (
    !Number.isInteger(direction) ||
    direction < LightingDirection.Left ||
    direction > LightingDirection.Right
  ) {
    throw new Error(`buildLightingDataReport: invalid lighting direction ${direction}`);
  }
}
