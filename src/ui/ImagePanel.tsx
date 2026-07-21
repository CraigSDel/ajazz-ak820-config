import { useEffect, useRef, useState } from "react";
import { useDeviceSession } from "../device/DeviceSession";
import { processStaticImage } from "../image/static";
import { isAnimatedWebP, processAnimatedImage } from "../image/animated";
import { uploadStaticImage, uploadAnimatedImage } from "../operations";
import { MAX_TFT_FRAMES, SCREEN_WIDTH, SCREEN_HEIGHT } from "../protocol/constants";

type Prepared = {
  frames: Uint8Array[];
  delaysMs: number[];
  files: { id: string; name: string; frameCount: number }[];
  staticSingle: boolean;
};

const STATIC_FRAME_DELAY_MS = 500;
const MAX_SELECTION_BYTES = 50 * 1024 * 1024;

export function ImagePanel() {
  const { controller, connected, activeOperation, runOperation } = useDeviceSession();
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputDisabled = !connected || activeOperation !== null || processing;

  useEffect(() => {
    if (!prepared) return;
    let frameIndex = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const showNext = () => {
      drawPreview(canvasRef.current, prepared.frames[frameIndex]);
      if (prepared.frames.length > 1) {
        const delay = Math.max(20, prepared.delaysMs[frameIndex]);
        frameIndex = (frameIndex + 1) % prepared.frames.length;
        timer = setTimeout(showNext, delay);
      }
    };
    showNext();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [prepared]);

  const onFiles = async (selectedFiles: readonly File[]) => {
    setStatus(null);
    setProgress(0);
    setPrepared(null);
    setProcessing(true);
    try {
      const selectionBytes = selectedFiles.reduce((total, file) => total + file.size, 0);
      if (selectedFiles.length > MAX_TFT_FRAMES) {
        throw new Error(`Choose no more than ${MAX_TFT_FRAMES} files at once.`);
      }
      if (selectionBytes > MAX_SELECTION_BYTES) {
        throw new Error("The selected files exceed the combined 50 MB limit.");
      }
      const frames: Uint8Array[] = [];
      const delaysMs: number[] = [];
      const files: Prepared["files"] = [];
      for (const original of selectedFiles) {
        const file = normalizeImageType(original);
        const id = `${original.name}-${original.size}-${original.lastModified}`;
        const animated =
          file.type === "image/gif" || (file.type === "image/webp" && (await isAnimatedWebP(file)));
        if (animated) {
          const result = await processAnimatedImage(file);
          frames.push(...result.frames);
          delaysMs.push(...result.delaysMs);
          files.push({ id, name: original.name, frameCount: result.frames.length });
        } else {
          frames.push(await processStaticImage(file));
          delaysMs.push(STATIC_FRAME_DELAY_MS);
          files.push({ id, name: original.name, frameCount: 1 });
        }
        if (frames.length > MAX_TFT_FRAMES) {
          throw new Error(
            `The selection contains ${frames.length} frames; the keyboard supports at most ${MAX_TFT_FRAMES}.`,
          );
        }
      }
      if (frames.length === 0) throw new Error("Choose at least one image.");
      setPrepared({
        frames,
        delaysMs,
        files,
        staticSingle: selectedFiles.length === 1 && frames.length === 1,
      });
      setStatus(
        `${selectedFiles.length} ${selectedFiles.length === 1 ? "image" : "images"} ready (${frames.length} ${frames.length === 1 ? "frame" : "frames"}).`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to process file");
    } finally {
      setProcessing(false);
    }
  };

  const onUpload = async () => {
    if (!prepared) return;
    setStatus("Uploading…");
    try {
      if (prepared.staticSingle) {
        await runOperation("image upload", () =>
          uploadStaticImage(controller, prepared.frames[0], setProgress),
        );
      } else {
        await runOperation("image upload", () =>
          uploadAnimatedImage(controller, prepared.frames, prepared.delaysMs, setProgress),
        );
      }
      setStatus("Uploaded");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Upload failed");
    }
  };

  return (
    <section className="panel display-panel">
      <header className="display-header">
        <div>
          <h3>Display image</h3>
          <p>Choose an image, check the preview, then send it to your keyboard.</p>
        </div>
        <span>128 × 128 TFT</span>
      </header>
      <div className="display-preview">
        <div className="display-device-preview">
          <canvas
            ref={canvasRef}
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            aria-label="Keyboard display image preview"
          />
        </div>
        {!prepared && <p className="empty-state-copy">Preview</p>}
      </div>
      <div className="display-controls">
        <label className={`file-control${inputDisabled ? " is-disabled" : ""}`}>
          <span>
            <strong>{processing ? "Preparing images…" : "Choose images"}</strong>
            <small>PNG, JPEG, WebP or GIF</small>
          </span>
          <input
            className="visually-hidden"
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={inputDisabled}
            onChange={(e) => e.target.files && void onFiles(Array.from(e.target.files))}
          />
        </label>
        {prepared && (
          <details className="image-selection">
            <summary>
              {prepared.files.length} {prepared.files.length === 1 ? "file" : "files"} ·{" "}
              {prepared.frames.length} {prepared.frames.length === 1 ? "frame" : "frames"}
            </summary>
            <ol>
              {prepared.files.map((file) => (
                <li key={file.id}>
                  <span>{file.name}</span>
                  <small>
                    {file.frameCount} frame{file.frameCount === 1 ? "" : "s"}
                  </small>
                </li>
              ))}
            </ol>
          </details>
        )}
        <button
          type="button"
          className="primary-action"
          aria-label="Upload image to keyboard"
          disabled={!connected || !prepared || activeOperation !== null || processing}
          onClick={onUpload}
        >
          Send to keyboard
        </button>
        <p className="display-format-note">
          Multiple images play in order. Still images show for 0.5 seconds each; up to{" "}
          {MAX_TFT_FRAMES} frames.
        </p>
        {progress > 0 && progress < 1 && (
          <div className="progress-status">
            <span>Uploading to keyboard</span>
            <strong>{Math.round(progress * 100)}%</strong>
            <progress value={progress} max={1} />
          </div>
        )}
        {status && (
          <p className="inline-status" role="status">
            {status}
          </p>
        )}
      </div>
    </section>
  );
}

function normalizeImageType(file: File): File {
  if (["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) return file;
  const extension = file.name.split(".").pop()?.toLowerCase();
  const mime =
    extension === "png"
      ? "image/png"
      : extension === "jpg" || extension === "jpeg"
        ? "image/jpeg"
        : extension === "webp"
          ? "image/webp"
          : extension === "gif"
            ? "image/gif"
            : null;
  if (!mime) throw new Error(`Unsupported image type: ${file.name}`);
  return new File([file], file.name, { type: mime, lastModified: file.lastModified });
}

function drawPreview(canvas: HTMLCanvasElement | null, rgb565: Uint8Array) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
  for (let i = 0; i < SCREEN_WIDTH * SCREEN_HEIGHT; i++) {
    const lo = rgb565[i * 2];
    const hi = rgb565[i * 2 + 1];
    const v = (hi << 8) | lo;
    const r = ((v >> 11) & 0x1f) << 3;
    const g = ((v >> 5) & 0x3f) << 2;
    const b = (v & 0x1f) << 3;
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
