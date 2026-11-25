export type DeviceError =
  | { kind: "unsupported-browser" }
  | { kind: "no-device-selected" }
  | { kind: "device-disconnected" }
  | { kind: "operation-in-progress"; operation: string }
  | { kind: "transfer-failed"; command: number; cause: unknown }
  | { kind: "ack-timeout"; chunkIndex: number; totalChunks: number }
  | { kind: "cancelled"; operation: string }
  | { kind: "validation"; message: string };

export class DeviceFailure extends Error {
  public readonly error: DeviceError;
  constructor(error: DeviceError) {
    super(describe(error));
    this.name = "DeviceFailure";
    this.error = error;
  }
}

function describe(e: DeviceError): string {
  switch (e.kind) {
    case "unsupported-browser":
      return "WebHID is not supported in this browser. Use Chrome or Edge.";
    case "no-device-selected":
      return "No device selected. Click Connect and pick your AK820 Pro.";
    case "device-disconnected":
      return "Keyboard was disconnected.";
    case "operation-in-progress":
      return `Cannot start while ${e.operation} is in progress.`;
    case "transfer-failed":
      return `Transfer to the keyboard failed (command 0x${e.command.toString(16).padStart(2, "0")}).`;
    case "ack-timeout":
      return `Keyboard did not acknowledge image chunk ${e.chunkIndex + 1} of ${e.totalChunks}. The upload was stopped.`;
    case "cancelled":
      return `The ${e.operation} was cancelled.`;
    case "validation":
      return e.message;
  }
}

/** The command byte of a packet, for error messages: `04 <cmd>` or the data packet's lead byte. */
export function commandOf(bytes: Uint8Array): number {
  return bytes[0] === 0x04 ? bytes[1] : (bytes[0] ?? 0);
}
