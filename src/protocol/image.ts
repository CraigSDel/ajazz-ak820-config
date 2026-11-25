import { CHUNK_SIZE, RGB565_FRAME_BYTES } from "./constants";
import { Command, commandPacket, type Packet } from "./packet";

// AKS075/Windows-driver framing used by AK820 Pro firmware:
// START (no enable flag) → IMAGE_CFG (sub 3, chunk count) → chunks → SAVE.
const IMAGE_CFG_SUBCOMMAND = 0x03;
const FRAME_HEADER_BYTES = 256;

/** Every data chunk is acknowledged with an input report starting with these bytes. */
export const IMAGE_ACK_PREFIX = [0x01, 0x5a, 0x02, 0x00] as const;

export function isImageAcknowledgement(data: DataView): boolean {
  if (data.byteLength < IMAGE_ACK_PREFIX.length) return false;
  return IMAGE_ACK_PREFIX.every((byte, index) => data.getUint8(index) === byte);
}

export function buildImageStartPacket(): Packet {
  return commandPacket(Command.Start);
}

export function buildImageCfgPacket(chunkCount: number): Packet {
  if (!Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > 0xffff) {
    throw new Error(
      `buildImageCfgPacket: chunk count must be a uint16 in [1, 0xFFFF], got ${chunkCount}`,
    );
  }
  const packet = commandPacket(Command.Image, { sub: IMAGE_CFG_SUBCOMMAND });
  packet[8] = chunkCount & 0xff;
  packet[9] = (chunkCount >> 8) & 0xff;
  return packet;
}

export function buildImageSavePacket(): Packet {
  return commandPacket(Command.Save);
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
