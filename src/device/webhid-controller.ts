import {
  AJAZZ_VENDOR_ID,
  AK820_PRO_PRODUCT_IDS,
  CONTROL_USAGE_PAGE,
  DATA_USAGE_PAGE,
} from "../protocol/constants";
import { isImageAcknowledgement } from "../protocol/image";
import { commandOf, DeviceFailure } from "./errors";
import type { DeviceController } from "./types";

type DevicePair = { control: HIDDevice; data: HIDDevice };

const MAX_PENDING_INPUT_REPORTS = 32;
// Feature reads are only best-effort handshakes. Some WebHID/firmware
// combinations never settle receiveFeatureReport(), which must not leave the
// global operation lock and UI stuck indefinitely.
const FEATURE_REPORT_TIMEOUT_MS = 300;

function hasUsagePage(device: HIDDevice, usagePage: number): boolean {
  return device.collections.some((collection) => collection.usagePage === usagePage);
}

function identityKey(device: HIDDevice): string {
  return [device.vendorId, device.productId, device.productName].join(":");
}

/** Pair interfaces belonging to the same physical keyboard. */
function findDevicePairs(devices: readonly HIDDevice[]): DevicePair[] {
  const groups = new Map<string, HIDDevice[]>();
  for (const device of devices) {
    if (device.vendorId !== AJAZZ_VENDOR_ID || !AK820_PRO_PRODUCT_IDS.includes(device.productId)) {
      continue;
    }
    const key = identityKey(device);
    groups.set(key, [...(groups.get(key) ?? []), device]);
  }

  const pairs: DevicePair[] = [];
  for (const group of groups.values()) {
    const controls = group.filter((device) => hasUsagePage(device, CONTROL_USAGE_PAGE));
    const dataDevices = group.filter((device) => hasUsagePage(device, DATA_USAGE_PAGE));
    // More than one matching interface makes the physical-device pairing
    // ambiguous, so let the browser picker narrow the result instead.
    if (controls.length === 1 && dataDevices.length === 1) {
      pairs.push({
        control: controls[0],
        data: dataDevices[0],
      });
    }
  }
  return pairs;
}

/** The AK820 Pro's vendor interfaces declare no report IDs, so all reports use 0. */
const UNNUMBERED_REPORT = 0;

export class WebHIDDeviceController implements DeviceController {
  private controlDevice: HIDDevice | null = null;
  private dataDevice: HIDDevice | null = null;
  private disconnectHandlers = new Set<() => void>();
  private boundDisconnectListener: ((event: HIDConnectionEvent) => void) | null = null;

  // Data-interface INPUT report plumbing: chunks of an image upload generate
  // an ACK input report each. Queue arrivals so `waitForDataInputReport` can
  // consume them one-by-one (handles the case where an ACK arrives before
  // the caller starts awaiting).
  private dataInputQueue: DataView[] = [];
  private dataInputWaiters: Array<(report: DataView | null) => void> = [];
  private boundDataInputListener: ((event: HIDInputReportEvent) => void) | null = null;

  isConnected(): boolean {
    return this.controlDevice?.opened === true && this.dataDevice?.opened === true;
  }

  async connect(): Promise<void> {
    if (typeof navigator === "undefined" || !("hid" in navigator)) {
      throw new DeviceFailure({ kind: "unsupported-browser" });
    }

    if (this.isConnected()) return;

    const filters = AK820_PRO_PRODUCT_IDS.map((productId) => ({
      vendorId: AJAZZ_VENDOR_ID,
      productId,
    }));

    const grantedPairs = findDevicePairs(await navigator.hid.getDevices());
    let pair = grantedPairs.length === 1 ? grantedPairs[0] : undefined;
    if (!pair) {
      const selected = await navigator.hid.requestDevice({ filters });
      const selectedPairs = findDevicePairs(selected);
      pair = selectedPairs.length === 1 ? selectedPairs[0] : undefined;
    }
    if (!pair) {
      throw new DeviceFailure({ kind: "no-device-selected" });
    }

    const { control, data } = pair;

    try {
      if (!control.opened) await control.open();
      if (!data.opened) await data.open();
    } catch (cause) {
      if (control.opened) await control.close().catch(() => undefined);
      if (data.opened) await data.close().catch(() => undefined);
      throw new DeviceFailure({ kind: "transfer-failed", command: 0, cause });
    }

    this.controlDevice = control;
    this.dataDevice = data;
    this.boundDataInputListener = (event: HIDInputReportEvent) => {
      if (!isImageAcknowledgement(event.data)) return;
      const waiter = this.dataInputWaiters.shift();
      if (waiter) {
        waiter(event.data);
      } else {
        this.dataInputQueue.push(event.data);
        // A faulty or hostile USB device must not be able to grow the page's
        // memory indefinitely by flooding unsolicited input reports.
        if (this.dataInputQueue.length > MAX_PENDING_INPUT_REPORTS) {
          this.dataInputQueue.shift();
        }
      }
    };
    data.addEventListener("inputreport", this.boundDataInputListener);

    this.boundDisconnectListener = (event: HIDConnectionEvent) => {
      if (event.device === control || event.device === data) {
        this.handleDisconnect();
      }
    };
    navigator.hid.addEventListener("disconnect", this.boundDisconnectListener);
  }

  async disconnect(): Promise<void> {
    // Always tear down local state, even if the browser fails to close a handle.
    try {
      if (this.controlDevice?.opened) await this.controlDevice.close();
      if (this.dataDevice?.opened) await this.dataDevice.close();
    } finally {
      this.handleDisconnect();
    }
  }

  private handleDisconnect(): void {
    if (this.boundDataInputListener && this.dataDevice) {
      this.dataDevice.removeEventListener("inputreport", this.boundDataInputListener);
    }
    this.boundDataInputListener = null;
    // Resolve any pending waiters with null so callers don't hang forever.
    for (const waiter of this.dataInputWaiters) waiter(null);
    this.dataInputWaiters = [];
    this.dataInputQueue = [];

    this.controlDevice = null;
    this.dataDevice = null;
    if (this.boundDisconnectListener) {
      navigator.hid.removeEventListener("disconnect", this.boundDisconnectListener);
      this.boundDisconnectListener = null;
    }
    for (const handler of this.disconnectHandlers) handler();
  }

  async sendFeatureReport(packet: Uint8Array): Promise<void> {
    await this.transfer(this.controlDevice, packet, (device) =>
      device.sendFeatureReport(UNNUMBERED_REPORT, packet as BufferSource),
    );
  }

  async sendReport(chunk: Uint8Array): Promise<void> {
    await this.transfer(this.dataDevice, chunk, (device) =>
      device.sendReport(UNNUMBERED_REPORT, chunk as BufferSource),
    );
  }

  private async transfer(
    device: HIDDevice | null,
    bytes: Uint8Array,
    send: (device: HIDDevice) => Promise<void>,
  ): Promise<void> {
    if (!device?.opened) throw new DeviceFailure({ kind: "device-disconnected" });
    try {
      await send(device);
    } catch (cause) {
      throw new DeviceFailure({ kind: "transfer-failed", command: commandOf(bytes), cause });
    }
  }

  async waitForDataInputReport(timeoutMs: number): Promise<DataView | null> {
    const device = this.dataDevice;
    if (!device?.opened) {
      throw new DeviceFailure({ kind: "device-disconnected" });
    }
    // If a report has already arrived since the last wait, return it.
    const queued = this.dataInputQueue.shift();
    if (queued) return queued;
    return new Promise<DataView | null>((resolve) => {
      const timer = setTimeout(() => {
        const index = this.dataInputWaiters.indexOf(wrappedResolver);
        if (index >= 0) this.dataInputWaiters.splice(index, 1);
        resolve(null);
      }, timeoutMs);
      const wrappedResolver = (report: DataView | null) => {
        clearTimeout(timer);
        resolve(report);
      };
      this.dataInputWaiters.push(wrappedResolver);
    });
  }

  clearPendingDataInputReports(): void {
    this.dataInputQueue = [];
  }

  async receiveFeatureReport(): Promise<DataView | null> {
    const device = this.controlDevice;
    if (!device?.opened) {
      throw new DeviceFailure({ kind: "device-disconnected" });
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        device.receiveFeatureReport(UNNUMBERED_REPORT).catch(() => null),
        new Promise<null>((resolve) => {
          timeout = setTimeout(() => resolve(null), FEATURE_REPORT_TIMEOUT_MS);
        }),
      ]);
    } catch {
      // Handshake reads are non-fatal — reference implementations ignore
      // errors and continue. Treat any failure here as "no data."
      return null;
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }

  onDisconnect(handler: () => void): () => void {
    this.disconnectHandlers.add(handler);
    return () => {
      this.disconnectHandlers.delete(handler);
    };
  }
}
