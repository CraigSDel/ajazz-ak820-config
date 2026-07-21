import type { ReportMessage } from "../protocol/types";
import {
  AJAZZ_VENDOR_ID,
  AK820_PRO_PRODUCT_IDS,
  CONTROL_USAGE_PAGE,
  DATA_USAGE_PAGE,
} from "../protocol/constants";
import {
  buildCommandPackets,
  COMMAND_USAGE_PAGE,
  parseCommandResponse,
  type CommandRequest,
} from "../protocol/custom-lighting";
import { DeviceFailure } from "./errors";
import type { DeviceController } from "./types";

type DevicePair = { control: HIDDevice; data: HIDDevice; command?: HIDDevice };

const MAX_PENDING_INPUT_REPORTS = 32;
const MAX_COMMAND_REPORT_LENGTH = 4096;

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
    const commandDevices = group.filter((device) => hasUsagePage(device, COMMAND_USAGE_PAGE));
    // More than one matching interface makes the physical-device pairing
    // ambiguous, so let the browser picker narrow the result instead.
    if (controls.length === 1 && dataDevices.length === 1) {
      pairs.push({
        control: controls[0],
        data: dataDevices[0],
        command: commandDevices.length === 1 ? commandDevices[0] : undefined,
      });
    }
  }
  return pairs;
}

/**
 * Adapt a `ReportMessage` (hidapi convention: first byte of the wire payload is
 * carried in `reportId`) to WebHID's send-shape for an unnumbered HID report.
 *
 * AJAZZ AK820 Pro's control interface declares unnumbered feature reports
 * (declared report ID = 0, full 64-byte payload). hidapi accepts the byte at
 * position 0 as the report ID and routes accordingly; Chrome's WebHID is
 * stricter and rejects any non-zero `reportId` that isn't declared in the
 * HID descriptor. So we always send unnumbered (reportId=0) with the
 * original leading byte spliced back to the front of the payload.
 */
function toUnnumberedWire(report: ReportMessage): { reportId: 0; bytes: Uint8Array } {
  const wire = new Uint8Array(report.bytes.byteLength + 1);
  wire[0] = report.reportId;
  wire.set(report.bytes, 1);
  return { reportId: 0, bytes: wire };
}

export class WebHIDDeviceController implements DeviceController {
  private controlDevice: HIDDevice | null = null;
  private dataDevice: HIDDevice | null = null;
  private commandDevice: HIDDevice | null = null;
  private commandTail: Promise<void> = Promise.resolve();
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

  getIdentity() {
    const device = this.controlDevice;
    return device
      ? { vendorId: device.vendorId, productId: device.productId, productName: device.productName }
      : null;
  }

  async connect(): Promise<void> {
    if (typeof navigator === "undefined" || !("hid" in navigator)) {
      throw new DeviceFailure({ kind: "unsupported-browser" });
    }

    const filters = AK820_PRO_PRODUCT_IDS.map((productId) => ({
      vendorId: AJAZZ_VENDOR_ID,
      productId,
    }));

    if (this.isConnected()) return;

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

    const { control, data, command } = pair;

    try {
      if (!control.opened) await control.open();
      if (!data.opened) await data.open();
      if (command && !command.opened) await command.open();
    } catch (cause) {
      if (control.opened) await control.close().catch(() => undefined);
      if (data.opened) await data.close().catch(() => undefined);
      if (command?.opened) await command.close().catch(() => undefined);
      throw new DeviceFailure({ kind: "transfer-failed", reportId: 0, cause });
    }

    this.controlDevice = control;
    this.dataDevice = data;
    this.commandDevice = command ?? null;

    this.boundDataInputListener = (event: HIDInputReportEvent) => {
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
    if (this.controlDevice?.opened) await this.controlDevice.close();
    if (this.dataDevice?.opened) await this.dataDevice.close();
    if (this.commandDevice?.opened) await this.commandDevice.close();
    this.handleDisconnect();
  }

  private handleDisconnect(): void {
    if (this.boundDataInputListener && this.dataDevice) {
      this.dataDevice.removeEventListener("inputreport", this.boundDataInputListener);
    }
    this.boundDataInputListener = null;
    // Resolve any pending waiters with null so callers don't hang forever.
    for (const w of this.dataInputWaiters) w(null);
    this.dataInputWaiters = [];
    this.dataInputQueue = [];

    this.controlDevice = null;
    this.dataDevice = null;
    this.commandDevice = null;
    if (this.boundDisconnectListener) {
      navigator.hid.removeEventListener("disconnect", this.boundDisconnectListener);
      this.boundDisconnectListener = null;
    }
    for (const h of this.disconnectHandlers) h();
  }

  async sendFeatureReport(report: ReportMessage): Promise<void> {
    const device = this.controlDevice;
    if (!device?.opened) {
      throw new DeviceFailure({ kind: "device-disconnected" });
    }
    const wire = toUnnumberedWire(report);
    try {
      await device.sendFeatureReport(wire.reportId, wire.bytes as BufferSource);
    } catch (cause) {
      throw new DeviceFailure({
        kind: "transfer-failed",
        reportId: report.reportId,
        cause,
      });
    }
  }

  async sendReport(report: ReportMessage): Promise<void> {
    const device = this.dataDevice;
    if (!device?.opened) {
      throw new DeviceFailure({ kind: "device-disconnected" });
    }
    // Data-interface OUTPUT reports are pure 4096-byte chunks sent as
    // unnumbered reports. We send `report.bytes` as-is with reportId=0 —
    // no leading byte to splice (operations.ts already supplies reportId=0).
    try {
      await device.sendReport(report.reportId, report.bytes as BufferSource);
    } catch (cause) {
      throw new DeviceFailure({
        kind: "transfer-failed",
        reportId: report.reportId,
        cause,
      });
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
        const idx = this.dataInputWaiters.indexOf(wrappedResolver);
        if (idx >= 0) this.dataInputWaiters.splice(idx, 1);
        resolve(null);
      }, timeoutMs);
      const wrappedResolver = (report: DataView | null) => {
        clearTimeout(timer);
        resolve(report);
      };
      this.dataInputWaiters.push(wrappedResolver);
    });
  }

  async receiveFeatureReport(reportId: number): Promise<DataView | null> {
    const device = this.controlDevice;
    if (!device?.opened) {
      throw new DeviceFailure({ kind: "device-disconnected" });
    }
    try {
      return await device.receiveFeatureReport(reportId);
    } catch {
      // Handshake reads are non-fatal — reference implementations ignore
      // errors and continue. Treat any failure here as "no data."
      return null;
    }
  }

  supportsCommandTransport(): boolean {
    return this.commandDevice?.opened === true;
  }

  async exchangeCommand(request: CommandRequest): Promise<Uint8Array> {
    const exchange = this.commandTail.then(() => this.exchangeCommandSerial(request));
    this.commandTail = exchange.then(
      () => undefined,
      () => undefined,
    );
    return exchange;
  }

  private async exchangeCommandSerial(request: CommandRequest): Promise<Uint8Array> {
    const device = this.commandDevice;
    if (!device?.opened) {
      throw new DeviceFailure({
        kind: "validation",
        message: "This keyboard does not expose the custom RGB command interface.",
      });
    }
    const reportLength = commandReportLength(device);
    const packets = buildCommandPackets(request, reportLength);
    const responseChunks: Uint8Array[] = [];
    for (const packet of packets) {
      let response: ReturnType<typeof parseCommandResponse> | null = null;
      let lastCause: unknown;
      for (let attempt = 0; attempt < 4 && !response; attempt += 1) {
        const responsePromise = waitForCommandResponse(device, request.command, 2000);
        try {
          await device.sendReport(0, packet as BufferSource);
          response = await responsePromise;
        } catch (cause) {
          lastCause = cause;
        }
      }
      if (!response) {
        throw new DeviceFailure({
          kind: "transfer-failed",
          reportId: request.command,
          cause: lastCause,
        });
      }
      responseChunks.push(response.payload);
    }
    const merged = new Uint8Array(responseChunks.reduce((sum, chunk) => sum + chunk.length, 0));
    let offset = 0;
    for (const chunk of responseChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged.slice(0, request.contentSize);
  }

  onDisconnect(handler: () => void): () => void {
    this.disconnectHandlers.add(handler);
    return () => {
      this.disconnectHandlers.delete(handler);
    };
  }
}

function commandReportLength(device: HIDDevice): number {
  const counts = device.collections.flatMap((collection) =>
    (collection.outputReports ?? []).flatMap((report) =>
      (report.items ?? []).map((item) => item.reportCount ?? 0),
    ),
  );
  const length = Math.max(0, ...counts);
  if (length <= 8 || length > MAX_COMMAND_REPORT_LENGTH) {
    throw new Error("The custom RGB interface has no usable output report.");
  }
  return length;
}

function waitForCommandResponse(
  device: HIDDevice,
  command: number,
  timeoutMs: number,
): Promise<ReturnType<typeof parseCommandResponse>> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      device.removeEventListener("inputreport", listener);
    };
    const listener = (event: HIDInputReportEvent) => {
      const bytes = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
      try {
        const response = parseCommandResponse(bytes);
        if (response.command !== command) return;
        cleanup();
        resolve(response);
      } catch {
        // Ignore unrelated or malformed reports and keep waiting for ours.
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Command 0x${command.toString(16)} timed out`));
    }, timeoutMs);
    device.addEventListener("inputreport", listener);
  });
}
