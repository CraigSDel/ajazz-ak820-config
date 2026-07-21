import type { ReportMessage } from "../protocol/types";
import type { CommandRequest } from "../protocol/custom-lighting";
import { DeviceFailure } from "./errors";
import type { DeviceController, SentReport } from "./types";

export class MockDeviceController implements DeviceController {
  public sent: SentReport[] = [];
  public receivedFeatureReportIds: number[] = [];
  public commandRequests: CommandRequest[] = [];
  private connected = false;
  private disconnectHandlers = new Set<() => void>();
  private sendCount = 0;
  private readonly options: {
    failSendAt?: number;
    healthCheckResponds?: boolean;
    dataAckResponds?: boolean;
    commandTransport?: boolean;
    commandResponse?: Uint8Array;
    productId?: number;
  };

  constructor(
    options: {
      failSendAt?: number;
      healthCheckResponds?: boolean;
      dataAckResponds?: boolean;
      commandTransport?: boolean;
      commandResponse?: Uint8Array;
      productId?: number;
    } = {},
  ) {
    this.options = options;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getIdentity() {
    return this.connected
      ? {
          vendorId: 0x0c45,
          productId: this.options.productId ?? 0x800a,
          productName: "Mock AK820 Pro",
        }
      : null;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    for (const h of this.disconnectHandlers) h();
  }

  async sendFeatureReport(report: ReportMessage): Promise<void> {
    if (!this.connected) {
      throw new DeviceFailure({ kind: "device-disconnected" });
    }
    this.recordSend({ ...report, kind: "feature" });
  }

  async sendReport(report: ReportMessage): Promise<void> {
    if (!this.connected) {
      throw new DeviceFailure({ kind: "device-disconnected" });
    }
    this.recordSend({ ...report, kind: "output" });
  }

  async receiveFeatureReport(reportId: number): Promise<DataView | null> {
    if (!this.connected) {
      throw new DeviceFailure({ kind: "device-disconnected" });
    }
    this.receivedFeatureReportIds.push(reportId);
    if (this.options.healthCheckResponds === false) return null;
    return new DataView(new ArrayBuffer(0));
  }

  async waitForDataInputReport(_timeoutMs: number): Promise<DataView | null> {
    if (!this.connected) {
      throw new DeviceFailure({ kind: "device-disconnected" });
    }
    return this.options.dataAckResponds === false ? null : new DataView(new ArrayBuffer(0));
  }

  supportsCommandTransport(): boolean {
    return this.connected && this.options.commandTransport === true;
  }

  async exchangeCommand(request: CommandRequest): Promise<Uint8Array> {
    if (!this.connected) throw new DeviceFailure({ kind: "device-disconnected" });
    if (!this.supportsCommandTransport()) {
      throw new DeviceFailure({ kind: "validation", message: "Command transport unavailable" });
    }
    this.commandRequests.push({
      ...request,
      data: request.data ? new Uint8Array(request.data) : undefined,
    });
    return this.options.commandResponse
      ? new Uint8Array(this.options.commandResponse)
      : new Uint8Array(request.contentSize);
  }

  onDisconnect(handler: () => void): () => void {
    this.disconnectHandlers.add(handler);
    return () => {
      this.disconnectHandlers.delete(handler);
    };
  }

  private recordSend(report: SentReport): void {
    this.sendCount += 1;
    if (this.sendCount === this.options.failSendAt) {
      throw new DeviceFailure({
        kind: "transfer-failed",
        reportId: report.reportId,
        cause: new Error("Injected mock transfer failure"),
      });
    }
    this.sent.push(report);
  }
}
