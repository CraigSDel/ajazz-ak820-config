import { afterEach, describe, expect, test, vi } from "vitest";
import { WebHIDDeviceController } from "../webhid-controller";

afterEach(() => {
  vi.useRealTimers();
});

describe("WebHIDDeviceController", () => {
  test("bounds a best-effort feature-report handshake", async () => {
    vi.useFakeTimers();
    const receiveFeatureReport = vi.fn(() => new Promise<DataView>(() => {}));
    const control = fakeDevice(0xff13, { receiveFeatureReport });
    const data = fakeDevice(0xff68);
    const hid = {
      getDevices: vi.fn(async () => [control, data]),
      requestDevice: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(navigator, "hid", { configurable: true, value: hid });

    const controller = new WebHIDDeviceController();
    await controller.connect();
    const result = controller.receiveFeatureReport(0);
    await vi.advanceTimersByTimeAsync(300);

    await expect(result).resolves.toBeNull();
    expect(receiveFeatureReport).toHaveBeenCalledWith(0);
  });

  test("sends packets unchanged as unnumbered report 0 on the right interface", async () => {
    const sendFeatureReport = vi.fn(async () => {});
    const sendReport = vi.fn(async () => {});
    const control = fakeDevice(0xff13, { sendFeatureReport });
    const data = fakeDevice(0xff68, { sendReport });
    installHid([control, data]);
    const controller = new WebHIDDeviceController();
    await controller.connect();

    const packet = Uint8Array.from({ length: 64 }, (_, i) => (i === 0 ? 0x04 : i));
    const chunk = new Uint8Array(4096).fill(0xab);
    await controller.sendFeatureReport(packet);
    await controller.sendReport(chunk);

    expect(sendFeatureReport).toHaveBeenCalledExactlyOnceWith(0, packet);
    expect(sendReport).toHaveBeenCalledExactlyOnceWith(0, chunk);
  });

  test("reports the failing command when the browser rejects a transfer", async () => {
    const control = fakeDevice(0xff13, {
      sendFeatureReport: vi.fn(async () => {
        throw new DOMException("NotAllowedError");
      }),
    });
    installHid([control, fakeDevice(0xff68)]);
    const controller = new WebHIDDeviceController();
    await controller.connect();
    const packet = new Uint8Array(64);
    packet.set([0x04, 0x13]);

    await expect(controller.sendFeatureReport(packet)).rejects.toMatchObject({
      error: { kind: "transfer-failed", command: 0x13 },
    });
  });

  test("only delivers well-formed image acknowledgements", async () => {
    let onInput: (event: HIDInputReportEvent) => void = () => {};
    const control = fakeDevice(0xff13);
    const data = fakeDevice(0xff68, {
      addEventListener: vi.fn((_type: string, listener: (event: HIDInputReportEvent) => void) => {
        onInput = listener;
      }) as unknown as HIDDevice["addEventListener"],
    });
    installHid([control, data]);
    const controller = new WebHIDDeviceController();
    await controller.connect();

    const pending = controller.waitForDataInputReport(1000);
    const report = (bytes: number[]) =>
      ({ data: new DataView(Uint8Array.from(bytes).buffer) }) as HIDInputReportEvent;
    onInput(report([0x01, 0x5a, 0xff, 0x00]));
    onInput(report([0x01, 0x5a, 0x02, 0x00, 0x07]));

    const acknowledgement = await pending;
    expect(acknowledgement?.getUint8(4)).toBe(0x07);
  });

  test("clears local state even when closing a device fails", async () => {
    const control = fakeDevice(0xff13, {
      close: vi.fn(async () => {
        throw new Error("close failed");
      }),
    });
    const data = fakeDevice(0xff68);
    installHid([control, data]);
    const controller = new WebHIDDeviceController();
    await controller.connect();
    const disconnected = vi.fn();
    controller.onDisconnect(disconnected);

    await expect(controller.disconnect()).rejects.toThrow("close failed");
    expect(controller.isConnected()).toBe(false);
    expect(disconnected).toHaveBeenCalledOnce();
  });
});

function installHid(devices: HIDDevice[]) {
  Object.defineProperty(navigator, "hid", {
    configurable: true,
    value: {
      getDevices: vi.fn(async () => devices),
      requestDevice: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
}

function fakeDevice(usagePage: number, overrides: Partial<HIDDevice> = {}): HIDDevice {
  return {
    vendorId: 0x0c45,
    productId: 0x8009,
    productName: "Mock AK820 Pro",
    collections: [{ usagePage }],
    opened: false,
    open: vi.fn(async function (this: HIDDevice) {
      Object.defineProperty(this, "opened", { configurable: true, value: true });
    }),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...overrides,
  } as unknown as HIDDevice;
}
