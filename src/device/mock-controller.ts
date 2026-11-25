import { commandOf, DeviceFailure } from "./errors";
import type { DeviceController, SentPacket } from "./types";

export class MockDeviceController implements DeviceController {
  public sent: SentPacket[] = [];
  public featureReads = 0;
  private connected = false;
  private disconnectHandlers = new Set<() => void>();
  private sendCount = 0;
  private readonly options: {
    failSendAt?: number;
    dataAckResponds?: boolean;
  };

  constructor(
    options: {
      failSendAt?: number;
      dataAckResponds?: boolean;
    } = {},
  ) {
    this.options = options;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    for (const handler of this.disconnectHandlers) handler();
  }

  async sendFeatureReport(packet: Uint8Array): Promise<void> {
    this.recordSend({ kind: "feature", bytes: packet });
  }

  async sendReport(chunk: Uint8Array): Promise<void> {
    this.recordSend({ kind: "output", bytes: chunk });
  }

  async receiveFeatureReport(): Promise<DataView | null> {
    if (!this.connected) {
      throw new DeviceFailure({ kind: "device-disconnected" });
    }
    this.featureReads += 1;
    return new DataView(new ArrayBuffer(0));
  }

  async waitForDataInputReport(_timeoutMs: number): Promise<DataView | null> {
    if (!this.connected) {
      throw new DeviceFailure({ kind: "device-disconnected" });
    }
    return this.options.dataAckResponds === false
      ? null
      : new DataView(Uint8Array.from([0x01, 0x5a, 0x02, 0x00]).buffer);
  }

  clearPendingDataInputReports(): void {}

  onDisconnect(handler: () => void): () => void {
    this.disconnectHandlers.add(handler);
    return () => {
      this.disconnectHandlers.delete(handler);
    };
  }

  private recordSend(packet: SentPacket): void {
    if (!this.connected) {
      throw new DeviceFailure({ kind: "device-disconnected" });
    }
    this.sendCount += 1;
    if (this.sendCount === this.options.failSendAt) {
      throw new DeviceFailure({
        kind: "transfer-failed",
        command: commandOf(packet.bytes),
        cause: new Error("Injected mock transfer failure"),
      });
    }
    this.sent.push(packet);
  }
}
