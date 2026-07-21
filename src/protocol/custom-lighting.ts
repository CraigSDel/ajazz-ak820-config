import { LightingDirection, LightingMode, type LightingConfig, type RGBColor } from "./lighting";

export const COMMAND_USAGE_PAGE = 0xff67;
export const GET_LED_EFFECT_COMMAND = 0x13;
export const GET_CUSTOM_LED_COMMAND = 0x14;
export const SET_LED_EFFECT_COMMAND = 0x23;
export const SET_CUSTOM_LED_COMMAND = 0x24;
export const CUSTOM_LIGHTING_MODE = 0x80;
export const CUSTOM_LED_COUNT = 128;
export const CUSTOM_LED_TABLE_BYTES = CUSTOM_LED_COUNT * 4;
export const COMMAND_HEADER_BYTES = 8;

export type CommandRequest = {
  command: number;
  contentSize: number;
  data?: Uint8Array;
};

export type CustomLed = RGBColor & { ledId: number };

export function buildCommandPackets(request: CommandRequest, reportLength: number): Uint8Array[] {
  if (!Number.isInteger(reportLength) || reportLength <= COMMAND_HEADER_BYTES) {
    throw new Error("buildCommandPackets: report length must be greater than 8");
  }
  if (!Number.isInteger(request.contentSize) || request.contentSize < 0) {
    throw new Error("buildCommandPackets: invalid content size");
  }
  if (request.data && request.data.byteLength !== request.contentSize) {
    throw new Error(
      `buildCommandPackets: data length ${request.data.byteLength} does not match ${request.contentSize}`,
    );
  }

  const payloadLength = reportLength - COMMAND_HEADER_BYTES;
  const packetCount = Math.max(1, Math.ceil(request.contentSize / payloadLength));
  return Array.from({ length: packetCount }, (_, packetIndex) => {
    const address = packetIndex * payloadLength;
    const remaining = request.contentSize - address;
    const length = Math.max(0, Math.min(payloadLength, remaining));
    const packet = new Uint8Array(reportLength);
    packet[0] = 0xaa;
    packet[1] = request.command;
    packet[2] = length;
    packet[3] = address & 0xff;
    packet[4] = (address >> 8) & 0xff;
    packet[6] = packetIndex === packetCount - 1 ? 1 : 0;
    if (request.data && length > 0) {
      packet.set(request.data.subarray(address, address + length), COMMAND_HEADER_BYTES);
    }
    return packet;
  });
}

export function parseCommandResponse(data: Uint8Array): {
  command: number;
  address: number;
  payload: Uint8Array;
} {
  if (data.byteLength < COMMAND_HEADER_BYTES || data[0] !== 0x55) {
    throw new Error("parseCommandResponse: invalid response header");
  }
  return {
    command: data[1],
    address: data[3] | (data[4] << 8),
    payload: data.slice(COMMAND_HEADER_BYTES),
  };
}

export function buildCustomLedTable(colors: readonly RGBColor[]): Uint8Array {
  if (colors.length > CUSTOM_LED_COUNT) {
    throw new Error(`buildCustomLedTable: at most ${CUSTOM_LED_COUNT} colors are supported`);
  }
  const table = new Uint8Array(CUSTOM_LED_TABLE_BYTES);
  for (let ledId = 0; ledId < CUSTOM_LED_COUNT; ledId++) {
    const color = colors[ledId] ?? { red: 0, green: 0, blue: 0 };
    validateColor(color);
    const offset = ledId * 4;
    table[offset] = ledId;
    table[offset + 1] = color.red;
    table[offset + 2] = color.green;
    table[offset + 3] = color.blue;
  }
  return table;
}

export function parseCustomLedTable(table: Uint8Array): CustomLed[] {
  if (table.byteLength < CUSTOM_LED_TABLE_BYTES) {
    throw new Error(`parseCustomLedTable: expected ${CUSTOM_LED_TABLE_BYTES} bytes`);
  }
  return Array.from({ length: CUSTOM_LED_COUNT }, (_, index) => {
    const offset = index * 4;
    return {
      ledId: table[offset],
      red: table[offset + 1],
      green: table[offset + 2],
      blue: table[offset + 3],
    };
  });
}

export function buildCustomModeData(brightness: number): Uint8Array {
  if (!Number.isInteger(brightness) || brightness < 1 || brightness > 6) {
    throw new Error("buildCustomModeData: brightness must be an integer in [1, 6]");
  }
  const data = new Uint8Array(16);
  data[0] = CUSTOM_LIGHTING_MODE;
  data[4] = 0xff;
  data[9] = brightness;
  data[14] = 0xaa;
  data[15] = 0x55;
  return data;
}

/** Build the official framed-command payload used by the current AJAZZ web driver. */
export function buildLedEffectData(config: LightingConfig): Uint8Array {
  validateLedEffectConfig(config);

  const data = new Uint8Array(16);
  data[0] = config.mode;
  data[1] = config.color.red;
  data[2] = config.color.green;
  data[3] = config.color.blue;
  data[4] = 0xff;
  data[8] = config.rainbow ? 1 : 0;
  data[9] = config.mode === LightingMode.Off ? 0 : config.brightness;
  data[10] = config.mode === LightingMode.Off ? 0 : config.speed;
  data[11] = config.direction;
  data[14] = 0xaa;
  data[15] = 0x55;
  return data;
}

function validateLedEffectConfig(config: LightingConfig): void {
  if (
    !Number.isInteger(config.mode) ||
    config.mode < LightingMode.Off ||
    config.mode > LightingMode.Shuttle
  ) {
    throw new Error(`buildLedEffectData: invalid lighting mode ${config.mode}`);
  }
  validateColor(config.color);
  for (const [name, value] of [
    ["brightness", config.brightness],
    ["speed", config.speed],
  ] as const) {
    if (!Number.isInteger(value) || value < 1 || value > 6) {
      throw new Error(`buildLedEffectData: ${name} must be an integer in [1, 6]`);
    }
  }
  if (
    !Number.isInteger(config.direction) ||
    config.direction < LightingDirection.Left ||
    config.direction > LightingDirection.Right
  ) {
    throw new Error(`buildLedEffectData: invalid lighting direction ${config.direction}`);
  }
}

function validateColor(color: RGBColor): void {
  for (const value of [color.red, color.green, color.blue]) {
    if (!Number.isInteger(value) || value < 0 || value > 0xff) {
      throw new Error("buildCustomLedTable: RGB values must be integers in [0, 255]");
    }
  }
}
