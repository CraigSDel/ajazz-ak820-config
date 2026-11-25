import type { Packet } from "../protocol/packet";

export type SentPacket = { kind: "feature" | "output"; bytes: Uint8Array };

export interface DeviceController {
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Send a 64-byte control packet as feature report 0. */
  sendFeatureReport(packet: Packet): Promise<void>;
  /** Send one 4096-byte image chunk as output report 0 on the data interface. */
  sendReport(chunk: Uint8Array): Promise<void>;
  /**
   * Read a feature report from the control interface. Used as a handshake
   * after specific SET packets in the AJAZZ protocol — the firmware appears
   * to require this read to acknowledge the previous SET and unblock the
   * next one. Implementations may treat failures as non-fatal and return
   * null; the caller should not depend on the returned value's contents.
   */
  receiveFeatureReport(): Promise<DataView | null>;
  /**
   * Wait for the next image-chunk acknowledgement from the data interface.
   * The AK820 Pro firmware drops chunks if the host doesn't read each ACK
   * before sending the next one. Implementations must only deliver reports
   * that satisfy `isImageAcknowledgement`, discarding anything else.
   * Resolves with the report, or `null` if none arrives within `timeoutMs`;
   * callers must then abort instead of continuing with corrupt data.
   */
  waitForDataInputReport(timeoutMs: number): Promise<DataView | null>;
  /** Discard reports left by an earlier or cancelled image transaction. */
  clearPendingDataInputReports(): void;
  onDisconnect(handler: () => void): () => void;
}

/** The part of a controller that device operations use while holding the lock. */
export type DeviceTransport = Pick<
  DeviceController,
  | "sendFeatureReport"
  | "sendReport"
  | "receiveFeatureReport"
  | "waitForDataInputReport"
  | "clearPendingDataInputReports"
>;
