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
});

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
