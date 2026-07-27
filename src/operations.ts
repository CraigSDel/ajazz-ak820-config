import { DeviceFailure } from "./device/errors";
import type { DeviceController } from "./device/types";
import { RGB565_FRAME_BYTES } from "./protocol/constants";
import {
  buildImageCfgReport,
  buildImageDataChunks,
  buildImageSaveReport,
  buildImageStartReport,
} from "./protocol/image";
import {
  buildLightingDataReport,
  buildLightingFinishReport,
  buildLightingModePreambleReport,
  buildLightingStartReport,
  type LightingConfig,
} from "./protocol/lighting";
import {
  buildLightingSleepDataReport,
  buildLightingSleepPreambleReport,
  type LightingSleepTime,
} from "./protocol/lighting-sleep";
import { buildTimeSyncReports } from "./protocol/time";

export type ProgressCallback = (fraction: number) => void;

// Inter-packet delays observed in reference implementations: ~40ms in
// aks075-linux between feature reports, 10ms in gohv with 100ms after SAVE.
// Without these the firmware appears to drop later packets even though the
// transport accepts them.
const INTER_PACKET_DELAY_MS = 50;
const POST_SAVE_DELAY_MS = 100;
const LIGHTING_RETRY_DELAY_MS = 150;
const CHUNK_ACK_TIMEOUT_MS = 300;
const IMAGE_ACK_PREFIX = [0x01, 0x5a, 0x02, 0x00] as const;
// Capture-derived implementations acknowledge every MODE_DATA report. Physical
// WebHID sweeps show that this firmware needs that handshake only for this
// subset; reading after other mode reports can prevent them from committing.
const MODE_DATA_HANDSHAKE_MODES: ReadonlySet<number> = new Set([0x04, 0x07, 0x09, 0x0b, 0x0d]);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function sendImageChunks(
  ctrl: DeviceController,
  chunks: readonly Uint8Array[],
  onProgress: ProgressCallback,
): Promise<void> {
  ctrl.clearPendingDataInputReports();
  for (let i = 0; i < chunks.length; i++) {
    await ctrl.sendReport({ reportId: 0, bytes: chunks[i] });
    const acknowledgement = await ctrl.waitForDataInputReport(CHUNK_ACK_TIMEOUT_MS);
    if (!acknowledgement) {
      throw new DeviceFailure({
        kind: "ack-timeout",
        chunkIndex: i,
        totalChunks: chunks.length,
      });
    }
    if (
      acknowledgement.byteLength < IMAGE_ACK_PREFIX.length ||
      !IMAGE_ACK_PREFIX.every((byte, index) => acknowledgement.getUint8(index) === byte)
    ) {
      throw new DeviceFailure({
        kind: "validation",
        message: `Invalid image acknowledgement for chunk ${i + 1} of ${chunks.length}`,
      });
    }
    onProgress((i + 1) / chunks.length);
  }
}

export async function syncTime(ctrl: DeviceController, date: Date): Promise<void> {
  // buildTimeSyncReports throws on invalid date.
  const [start, preamble, data, save] = buildTimeSyncReports(date);

  // Sequence mirrors aks075 driver: short sleeps after START and TIME_DATA,
  // handshake reads after TIME_PREAMBLE (TIME_CFG) and SAVE. The handshake
  // is what the firmware appears to wait on before processing the next SET.
  await ctrl.sendFeatureReport(start);
  await sleep(INTER_PACKET_DELAY_MS);

  await ctrl.sendFeatureReport(preamble);
  await ctrl.receiveFeatureReport(0);

  await ctrl.sendFeatureReport(data);
  await sleep(INTER_PACKET_DELAY_MS);

  await ctrl.sendFeatureReport(save);
  await ctrl.receiveFeatureReport(0);
  await sleep(POST_SAVE_DELAY_MS);
}

export async function setLighting(ctrl: DeviceController, config: LightingConfig): Promise<void> {
  // Built-in effects on the original wired AK820 Pro use the captured
  // four-report feature transaction. The optional 0xFF67 command interface is
  // retained only for custom per-key RGB; its generic SET-effect command is not
  // validated for these presets and can acknowledge modes that remain dark.
  const featureConfig: LightingConfig = {
    ...config,
    brightness: Math.min(config.brightness, 5) as LightingConfig["brightness"],
    speed: Math.min(config.speed, 5) as LightingConfig["speed"],
  };
  const reports = [
    buildLightingStartReport(),
    buildLightingModePreambleReport(),
    buildLightingDataReport(featureConfig),
    buildLightingFinishReport(),
  ];

  // Hardware testing found that the keyboard sometimes acknowledges the first
  // transaction without committing it. Repeating the complete transaction is
  // the reliable equivalent of the previously required second Apply click.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(LIGHTING_RETRY_DELAY_MS);
    for (const [reportIndex, report] of reports.entries()) {
      await ctrl.sendFeatureReport(report);
      const isModeData = reportIndex === 2;
      const needsHandshake = isModeData
        ? MODE_DATA_HANDSHAKE_MODES.has(featureConfig.mode)
        : report.reportId === 0x04;
      if (needsHandshake) await ctrl.receiveFeatureReport(0);
      await sleep(INTER_PACKET_DELAY_MS);
    }
    await sleep(POST_SAVE_DELAY_MS);
  }
}

export async function setLightingSleepTime(
  ctrl: DeviceController,
  sleepTime: LightingSleepTime,
): Promise<void> {
  const reports = [
    buildLightingStartReport(),
    buildLightingSleepPreambleReport(),
    buildLightingSleepDataReport(sleepTime),
  ];

  for (const report of reports) {
    await ctrl.sendFeatureReport(report);
    if (report.reportId === 0x04) await ctrl.receiveFeatureReport(0);
    await sleep(INTER_PACKET_DELAY_MS);
  }
  await sleep(POST_SAVE_DELAY_MS);
}

export async function uploadStaticImage(
  ctrl: DeviceController,
  rgb565: Uint8Array,
  onProgress: ProgressCallback,
): Promise<void> {
  if (rgb565.byteLength !== RGB565_FRAME_BYTES) {
    throw new DeviceFailure({
      kind: "validation",
      message: `Image buffer must be ${RGB565_FRAME_BYTES} bytes, got ${rgb565.byteLength}`,
    });
  }

  // Static path — AKS075 framing used by the Windows driver.
  // START(byte7=0) → IMAGE_CFG(sub=0x03) → header + pixels → SAVE(0x02)
  const chunks = buildImageDataChunks([rgb565], undefined);
  onProgress(0);

  await ctrl.sendFeatureReport(buildImageStartReport());
  await ctrl.receiveFeatureReport(0);

  await ctrl.sendFeatureReport(buildImageCfgReport(chunks.length));
  await ctrl.receiveFeatureReport(0);

  await sendImageChunks(ctrl, chunks, onProgress);

  await sleep(INTER_PACKET_DELAY_MS);
  await ctrl.sendFeatureReport(buildImageSaveReport());
  await ctrl.receiveFeatureReport(0);
  await sleep(POST_SAVE_DELAY_MS);
  onProgress(1);
}

export async function uploadAnimatedImage(
  ctrl: DeviceController,
  frames: readonly Uint8Array[],
  delaysMs: readonly number[],
  onProgress: ProgressCallback,
): Promise<void> {
  if (frames.length !== delaysMs.length) {
    throw new DeviceFailure({
      kind: "validation",
      message: `Frame count ${frames.length} does not match delays length ${delaysMs.length}`,
    });
  }

  // The shared image framing carries the frame count and delays in its
  // 256-byte header; a one-frame upload is simply the static case.
  const chunks = buildImageDataChunks(frames, delaysMs);
  onProgress(0);

  await ctrl.sendFeatureReport(buildImageStartReport());
  await ctrl.receiveFeatureReport(0);

  await ctrl.sendFeatureReport(buildImageCfgReport(chunks.length));
  await ctrl.receiveFeatureReport(0);

  await sendImageChunks(ctrl, chunks, onProgress);

  await sleep(INTER_PACKET_DELAY_MS);
  await ctrl.sendFeatureReport(buildImageSaveReport());
  await ctrl.receiveFeatureReport(0);
  await sleep(POST_SAVE_DELAY_MS);
  onProgress(1);
}
