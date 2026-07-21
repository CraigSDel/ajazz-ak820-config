import { describe, expect, test } from "vitest";
import { MockDeviceController } from "../../device/mock-controller";
import {
  GET_CUSTOM_LED_COMMAND,
  GET_LED_EFFECT_COMMAND,
  SET_CUSTOM_LED_COMMAND,
  SET_LED_EFFECT_COMMAND,
} from "../../protocol/custom-lighting";
import {
  applyCustomLighting,
  canUseCustomLighting,
  readCustomLighting,
  restoreCustomLighting,
} from "../custom";

describe("custom lighting operations", () => {
  test("is capability-gated", async () => {
    const controller = new MockDeviceController();
    await controller.connect();
    expect(canUseCustomLighting(controller)).toBe(false);
    await expect(applyCustomLighting(controller, [], 5)).rejects.toThrow(/unavailable/i);
  });

  test("backs up, selects mode 128, then writes the indexed table", async () => {
    const controller = new MockDeviceController({ commandTransport: true });
    await controller.connect();
    const backup = await applyCustomLighting(controller, [{ red: 12, green: 34, blue: 56 }], 6);

    expect(controller.commandRequests.map((request) => request.command)).toEqual([
      GET_LED_EFFECT_COMMAND,
      GET_CUSTOM_LED_COMMAND,
      SET_LED_EFFECT_COMMAND,
      SET_CUSTOM_LED_COMMAND,
    ]);
    expect(controller.commandRequests[2].data?.[0]).toBe(128);
    expect([...(controller.commandRequests[3].data?.slice(0, 4) ?? [])]).toEqual([0, 12, 34, 56]);
    expect(backup.colors).toHaveLength(128);
  });

  test("does not overlap effect and custom-table backup commands", async () => {
    const controller = new MockDeviceController({ commandTransport: true });
    await controller.connect();
    const exchange = controller.exchangeCommand.bind(controller);
    let active = 0;
    let overlapped = false;
    controller.exchangeCommand = async (request) => {
      active += 1;
      overlapped ||= active > 1;
      await Promise.resolve();
      try {
        return await exchange(request);
      } finally {
        active -= 1;
      }
    };

    await readCustomLighting(controller);

    expect(overlapped).toBe(false);
  });

  test("restores the color table before the previous effect", async () => {
    const controller = new MockDeviceController({ commandTransport: true });
    await controller.connect();
    await restoreCustomLighting(controller, {
      previousEffect: new Uint8Array(16).fill(7),
      colors: [{ ledId: 0, red: 1, green: 2, blue: 3 }],
    });
    expect(controller.commandRequests.map((request) => request.command)).toEqual([
      SET_CUSTOM_LED_COMMAND,
      SET_LED_EFFECT_COMMAND,
    ]);
    expect([...(controller.commandRequests[0].data?.slice(0, 4) ?? [])]).toEqual([0, 1, 2, 3]);
  });
});
