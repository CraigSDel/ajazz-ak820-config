import type { DeviceController } from "../device/types";
import {
  buildCustomLedTable,
  buildCustomModeData,
  GET_CUSTOM_LED_COMMAND,
  GET_LED_EFFECT_COMMAND,
  parseCustomLedTable,
  SET_CUSTOM_LED_COMMAND,
  SET_LED_EFFECT_COMMAND,
  type CustomLed,
} from "../protocol/custom-lighting";
import type { RGBColor } from "../protocol/lighting";

export type CustomLightingBackup = {
  previousEffect: Uint8Array;
  colors: CustomLed[];
};

export function canUseCustomLighting(controller: DeviceController): boolean {
  return controller.isConnected() && controller.supportsCommandTransport();
}

export async function readCustomLighting(
  controller: DeviceController,
): Promise<CustomLightingBackup> {
  requireCommandTransport(controller);
  // The supplemental web implementation keeps this endpoint strictly sequential. Interleaving
  // the one-packet effect read with the multi-packet table read can make older
  // 820PRO firmware associate an acknowledgement with the wrong request.
  const previousEffect = await controller.exchangeCommand({
    command: GET_LED_EFFECT_COMMAND,
    contentSize: 16,
  });
  const table = await controller.exchangeCommand({
    command: GET_CUSTOM_LED_COMMAND,
    contentSize: 512,
  });
  return { previousEffect, colors: parseCustomLedTable(table) };
}

export async function applyCustomLighting(
  controller: DeviceController,
  colors: readonly RGBColor[],
  brightness: number,
): Promise<CustomLightingBackup> {
  const backup = await readCustomLighting(controller);
  await controller.exchangeCommand({
    command: SET_LED_EFFECT_COMMAND,
    contentSize: 16,
    data: buildCustomModeData(brightness),
  });
  const table = buildCustomLedTable(colors);
  await controller.exchangeCommand({
    command: SET_CUSTOM_LED_COMMAND,
    contentSize: table.length,
    data: table,
  });
  return backup;
}

export async function restoreCustomLighting(
  controller: DeviceController,
  backup: CustomLightingBackup,
): Promise<void> {
  requireCommandTransport(controller);
  const table = buildCustomLedTable(backup.colors);
  await controller.exchangeCommand({
    command: SET_CUSTOM_LED_COMMAND,
    contentSize: table.length,
    data: table,
  });
  if (backup.previousEffect.byteLength === 16) {
    await controller.exchangeCommand({
      command: SET_LED_EFFECT_COMMAND,
      contentSize: 16,
      data: backup.previousEffect,
    });
  }
}

function requireCommandTransport(controller: DeviceController): void {
  if (!canUseCustomLighting(controller)) {
    throw new Error("Custom RGB is unavailable: the keyboard has no compatible command interface.");
  }
}
