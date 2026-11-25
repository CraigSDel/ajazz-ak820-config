import { DeviceFailure } from "./device/errors";
import type { DeviceTransport } from "./device/types";
import { RGB565_FRAME_BYTES } from "./protocol/constants";
import {
  buildImageCfgPacket,
  buildImageDataChunks,
  buildImageSavePacket,
  buildImageStartPacket,
} from "./protocol/image";
import {
  buildLightingPackets,
  type LightingConfig,
  LightingMode,
  MODE_DATA_PACKET_INDEX,
} from "./protocol/lighting";
import { buildLightingSleepPackets, type LightingSleepTime } from "./protocol/lighting-sleep";
import { isCommandPacket } from "./protocol/packet";
import { buildTimeSyncPackets } from "./protocol/time";

type ProgressCallback = (fraction: number) => void;

// Inter-packet delays observed in reference implementations: ~40ms in
// aks075-linux between feature reports, 10ms in gohv with 100ms after SAVE.
// Without these the firmware appears to drop later packets even though the
// transport accepts them.
const INTER_PACKET_DELAY_MS = 50;
const POST_SAVE_DELAY_MS = 100;
const LIGHTING_RETRY_DELAY_MS = 150;
const CHUNK_ACK_TIMEOUT_MS = 300;
// Capture-derived implementations acknowledge every MODE_DATA report. Physical
// WebHID sweeps show that this firmware needs that handshake only for this
// subset; reading after other mode reports can prevent them from committing.
const MODE_DATA_HANDSHAKE_MODES: ReadonlySet<LightingMode> = new Set([
  LightingMode.Glittering,
  LightingMode.Breath,
  LightingMode.Outward,
  LightingMode.Rolling,
  LightingMode.Explode,
]);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DeviceFailure({ kind: "cancelled", operation: "image upload" });
}

async function sendImageChunks(
  controller: DeviceTransport,
  chunks: readonly Uint8Array[],
  onProgress: ProgressCallback,
  signal: AbortSignal | undefined,
): Promise<void> {
  controller.clearPendingDataInputReports();
  for (const [index, chunk] of chunks.entries()) {
    throwIfCancelled(signal);
    await controller.sendReport(chunk);
    // The controller only delivers well-formed acknowledgements; anything
    // else is discarded at the transport, so absence is the only failure.
    const acknowledgement = await controller.waitForDataInputReport(CHUNK_ACK_TIMEOUT_MS);
    if (!acknowledgement) {
      throw new DeviceFailure({
        kind: "ack-timeout",
        chunkIndex: index,
        totalChunks: chunks.length,
      });
    }
    onProgress((index + 1) / chunks.length);
  }
}

export async function syncTime(controller: DeviceTransport, date: Date): Promise<void> {
  // buildTimeSyncPackets throws on an invalid date.
  const [start, time, data, save] = buildTimeSyncPackets(date);

  // Mirrors the aks075 driver: short sleeps after START and TIME_DATA,
  // handshake reads after TIME and SAVE, which the firmware waits on before
  // processing the next SET.
  await controller.sendFeatureReport(start);
  await sleep(INTER_PACKET_DELAY_MS);

  await controller.sendFeatureReport(time);
  await controller.receiveFeatureReport();

  await controller.sendFeatureReport(data);
  await sleep(INTER_PACKET_DELAY_MS);

  await controller.sendFeatureReport(save);
  await controller.receiveFeatureReport();
  await sleep(POST_SAVE_DELAY_MS);
}

export async function setLighting(
  controller: DeviceTransport,
  config: LightingConfig,
): Promise<void> {
  // Built-in effects use the captured four-packet feature transaction. The
  // optional 0xFF67 command interface is reserved for custom per-key RGB; its
  // generic SET-effect command can acknowledge modes that remain dark.
  const packets = buildLightingPackets(config);

  // Hardware testing found that the keyboard sometimes acknowledges the first
  // transaction without committing it. Repeating the complete transaction is
  // the reliable equivalent of the previously required second Apply click.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(LIGHTING_RETRY_DELAY_MS);
    for (const [index, packet] of packets.entries()) {
      await controller.sendFeatureReport(packet);
      const isModeData = index === MODE_DATA_PACKET_INDEX;
      const needsHandshake = isModeData
        ? MODE_DATA_HANDSHAKE_MODES.has(config.mode)
        : isCommandPacket(packet);
      if (needsHandshake) await controller.receiveFeatureReport();
      await sleep(INTER_PACKET_DELAY_MS);
    }
    await sleep(POST_SAVE_DELAY_MS);
  }
}

export async function setLightingSleepTime(
  controller: DeviceTransport,
  sleepTime: LightingSleepTime,
): Promise<void> {
  // Handshake after START and SLEEP only; never after the data packet.
  for (const packet of buildLightingSleepPackets(sleepTime)) {
    await controller.sendFeatureReport(packet);
    if (isCommandPacket(packet)) await controller.receiveFeatureReport();
    await sleep(INTER_PACKET_DELAY_MS);
  }
  await sleep(POST_SAVE_DELAY_MS);
}

export type UploadOptions = {
  onProgress: ProgressCallback;
  /** Aborting stops before the next chunk; the keyboard keeps its previous image. */
  signal?: AbortSignal;
};

/**
 * Upload one or more RGB565 frames to the TFT using the AKS075 framing:
 * START → IMAGE_CFG(chunk count) → 256-byte header + pixels → SAVE.
 * `delaysMs` is omitted for a single still image (header delay 0).
 */
export async function uploadImage(
  controller: DeviceTransport,
  frames: readonly Uint8Array[],
  delaysMs: readonly number[] | undefined,
  { onProgress, signal }: UploadOptions,
): Promise<void> {
  for (const frame of frames) {
    if (frame.byteLength !== RGB565_FRAME_BYTES) {
      throw new DeviceFailure({
        kind: "validation",
        message: `Image buffer must be ${RGB565_FRAME_BYTES} bytes, got ${frame.byteLength}`,
      });
    }
  }
  if (delaysMs && frames.length !== delaysMs.length) {
    throw new DeviceFailure({
      kind: "validation",
      message: `Frame count ${frames.length} does not match delays length ${delaysMs.length}`,
    });
  }

  const chunks = buildImageDataChunks(frames, delaysMs);
  throwIfCancelled(signal);
  onProgress(0);

  await controller.sendFeatureReport(buildImageStartPacket());
  await controller.receiveFeatureReport();

  await controller.sendFeatureReport(buildImageCfgPacket(chunks.length));
  await controller.receiveFeatureReport();

  await sendImageChunks(controller, chunks, onProgress, signal);

  await sleep(INTER_PACKET_DELAY_MS);
  await controller.sendFeatureReport(buildImageSavePacket());
  await controller.receiveFeatureReport();
  await sleep(POST_SAVE_DELAY_MS);
  onProgress(1);
}
