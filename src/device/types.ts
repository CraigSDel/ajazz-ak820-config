import type { ReportMessage } from "../protocol/types";
import type { CommandRequest } from "../protocol/custom-lighting";

export type SentReport = ReportMessage & { kind: "feature" | "output" };
export type DeviceIdentity = {
  vendorId: number;
  productId: number;
  productName: string;
};

export interface DeviceController {
  isConnected(): boolean;
  getIdentity(): DeviceIdentity | null;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendFeatureReport(report: ReportMessage): Promise<void>;
  sendReport(report: ReportMessage): Promise<void>;
  /**
   * Read a feature report from the control interface. Used as a handshake
   * after specific SET packets in the AJAZZ protocol — the firmware appears
   * to require this read to acknowledge the previous SET and unblock the
   * next one. Implementations may treat failures as non-fatal and return
   * null; the caller should not depend on the returned value's contents.
   */
  receiveFeatureReport(reportId: number): Promise<DataView | null>;
  /**
   * Wait for the next INPUT report from the data interface. Used as a
   * per-chunk ACK during image upload — the AK820 Pro firmware drops chunks
   * if the host doesn't read each ACK before sending the next one.
   * Resolves with the report data, or `null` if no report arrives within
   * `timeoutMs`. A timeout means the firmware may have dropped the chunk;
   * upload callers must abort instead of continuing with corrupt data.
   */
  waitForDataInputReport(timeoutMs: number): Promise<DataView | null>;
  /** Whether the keyboard exposes the official 0xFF67 framed-command interface. */
  supportsCommandTransport(): boolean;
  /** Exchange all chunks of an official framed command and return its content bytes. */
  exchangeCommand(request: CommandRequest): Promise<Uint8Array>;
  onDisconnect(handler: () => void): () => void;
}
