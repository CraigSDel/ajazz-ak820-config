import { CHUNK_SIZE } from "./constants";
import type { ReportMessage } from "./types";

// AKS075/Windows-driver framing used by AK820 Pro firmware.
const CONTROL_LEAD = 0x04;
const CMD_START = 0x18;
const CMD_IMAGE = 0x72;
const CMD_SAVE = 0x02;
const IMAGE_CFG_SUBCOMMAND = 0x03;
const PAYLOAD_LENGTH = 63; // 64-byte packet minus reportId byte
const RGB565_FRAME_BYTES = 128 * 128 * 2; // 32768
const FRAME_HEADER_BYTES = 256;

export function buildImageStartReport(): ReportMessage {
  const bytes = new Uint8Array(PAYLOAD_LENGTH);
  bytes[0] = CMD_START;
  // bytes[7] = 0 (AKS075 sends enable=false for image transfer)
  return { reportId: CONTROL_LEAD, bytes };
}

export function buildImageCfgReport(chunkCount: number): ReportMessage {
  if (!Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > 0xffff) {
    throw new Error(
      `buildImageCfgReport: chunk count must be a uint16 in [1, 0xFFFF], got ${chunkCount}`,
    );
  }
  const bytes = new Uint8Array(PAYLOAD_LENGTH);
  bytes[0] = CMD_IMAGE;
  bytes[1] = IMAGE_CFG_SUBCOMMAND;
  bytes[7] = chunkCount & 0xff;
  bytes[8] = (chunkCount >> 8) & 0xff;
  return { reportId: CONTROL_LEAD, bytes };
}

export function buildImageSaveReport(): ReportMessage {
  const bytes = new Uint8Array(PAYLOAD_LENGTH);
  bytes[0] = CMD_SAVE;
  // bytes[7] = 0 (AKS075 SAVE has no enable flag)
  return { reportId: CONTROL_LEAD, bytes };
}

export function buildImageDataChunks(
  frames: readonly Uint8Array[],
  delaysMs?: readonly number[],
): Uint8Array[] {
  if (frames.length < 1) {
    throw new Error("buildImageDataChunks: at least one frame required");
  }
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].byteLength !== RGB565_FRAME_BYTES) {
      throw new Error(
        `buildImageDataChunks: frame ${i} is ${frames[i].byteLength} bytes, expected ${RGB565_FRAME_BYTES}`,
      );
    }
  }
  if (delaysMs && delaysMs.length !== frames.length) {
    throw new Error(
      `buildImageDataChunks: delay count ${delaysMs.length} does not match frame count ${frames.length}`,
    );
  }

  // AKS075 framing starts with a 256-byte frame header. A static upload has
  // frame_count=1 and delay=0; remaining header and chunk padding bytes are FF.
  const payloadSize = FRAME_HEADER_BYTES + frames.length * RGB565_FRAME_BYTES;
  const chunkCount = Math.ceil(payloadSize / CHUNK_SIZE);
  const totalSize = chunkCount * CHUNK_SIZE;

  const payload = new Uint8Array(totalSize).fill(0xff);
  payload[0] = frames.length;
  for (let i = 0; i < frames.length; i++) {
    payload[1 + i] = delaysMs ? Math.min(255, Math.max(1, Math.floor(delaysMs[i] / 2))) : 0;
  }
  let offset = FRAME_HEADER_BYTES;
  for (let f = 0; f < frames.length; f++) {
    payload.set(frames[f], offset);
    offset += frames[f].byteLength;
  }

  const chunks: Uint8Array[] = [];
  for (let i = 0; i < chunkCount; i++) {
    chunks.push(payload.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
  }
  return chunks;
}
