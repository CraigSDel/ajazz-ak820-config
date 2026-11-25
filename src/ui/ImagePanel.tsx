import { useEffect, useRef, useState } from "preact/hooks";
import { useDeviceSession } from "../device/DeviceSession";
import { type PreparedImages, prepareImages } from "../image/prepare";
import { IMAGE_PRESETS, type ImagePreset } from "../image/presets";
import { rgb565ToRgba } from "../image/rgb565";
import { uploadImage } from "../operations";
import { MAX_TFT_FRAMES, SCREEN_HEIGHT, SCREEN_WIDTH } from "../protocol/constants";
import { classNames, errorMessage, plural } from "./text";

/** Browsers can't usefully show frames faster than this, whatever the file asks for. */
const MIN_PREVIEW_FRAME_MS = 20;

export function ImagePanel() {
  const { connected, activeOperation, runOperation } = useDeviceSession();
  const [prepared, setPrepared] = useState<PreparedImages | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);
  const uploading = activeOperation === "image upload";
  // Preparing and previewing images is local; only sending needs the keyboard.
  const inputDisabled = activeOperation !== null || processing;

  useEffect(() => {
    if (!prepared) return;
    let frameIndex = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const showNext = () => {
      drawPreview(canvasRef.current, prepared.frames[frameIndex]);
      if (prepared.frames.length > 1) {
        const delay = Math.max(MIN_PREVIEW_FRAME_MS, prepared.delaysMs[frameIndex]);
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
      const images = await prepareImages(selectedFiles);
      setPrepared(images);
      setStatus(
        `${plural(selectedFiles.length, "image")} ready (${plural(images.frames.length, "frame")}).`,
      );
    } catch (error) {
      setStatus(errorMessage(error, "Failed to process file"));
    } finally {
      setProcessing(false);
    }
  };

  const onUpload = async () => {
    if (!prepared) return;
    const abort = new AbortController();
    uploadAbort.current = abort;
    setStatus("Uploading…");
    setProgress(0);
    try {
      await runOperation("image upload", (operationController) =>
        uploadImage(
          operationController,
          prepared.frames,
          prepared.isSingleStill ? undefined : prepared.delaysMs,
          { onProgress: setProgress, signal: abort.signal },
        ),
      );
      setStatus("Uploaded");
    } catch (error) {
      if (abort.signal.aborted) {
        setStatus(
          "Upload cancelled before the keyboard saved it. If the display looks wrong, send an image again.",
        );
      } else {
        setStatus(errorMessage(error, "Upload failed"));
      }
    } finally {
      uploadAbort.current = null;
      setProgress(0);
    }
  };

  useEffect(() => () => uploadAbort.current?.abort(), []);

  const onPreset = async (preset: ImagePreset) => {
    setStatus(null);
    setProcessing(true);
    try {
      const response = await fetch(preset.url);
      if (!response.ok) throw new Error(`Could not load ${preset.name}.`);
      const blob = await response.blob();
      const file = new File([blob], preset.fileName, { type: blob.type });
      await onFiles([file]);
    } catch (error) {
      setStatus(errorMessage(error, "Failed to load preset image"));
      setProcessing(false);
    }
  };

  const timingNote = prepared && describeTiming(prepared);

  return (
    <section className="panel display-panel">
      <header className="display-header">
        <div>
          <h3>Display image</h3>
          <p>Choose an image, check the preview, then send it to your keyboard.</p>
        </div>
        <span>128 × 128 TFT</span>
      </header>
      <section
        className={classNames("display-preview", dragging && "is-drop-target")}
        aria-label="Image preview. Drop image files here."
        onDragOver={(event) => {
          if (inputDisabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (inputDisabled) return;
          const dropped = Array.from(event.dataTransfer?.files ?? []);
          if (dropped.length > 0) void onFiles(dropped);
        }}
      >
        <div className="display-device-preview">
          <canvas
            ref={canvasRef}
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            aria-label="Keyboard display image preview"
          />
        </div>
        {!prepared && <p className="empty-state-copy">Drop images here to preview</p>}
      </section>
      <div className="display-controls">
        <fieldset className="image-presets" disabled={inputDisabled}>
          <legend>Try a bundled image</legend>
          <div>
            {IMAGE_PRESETS.map((preset) => (
              <button
                type="button"
                className="image-preset"
                onClick={() => void onPreset(preset)}
                key={preset.fileName}
              >
                <img src={preset.url} alt="" />
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <label className={classNames("file-control", inputDisabled && "is-disabled")}>
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
            onChange={(event) => {
              const chosen = Array.from(event.currentTarget.files ?? []);
              // Reset so choosing the same file again still fires onChange.
              event.currentTarget.value = "";
              if (chosen.length > 0) void onFiles(chosen);
            }}
          />
        </label>
        {prepared && (
          <details className="image-selection">
            <summary>
              {plural(prepared.files.length, "file")} · {plural(prepared.frames.length, "frame")}
            </summary>
            <ol>
              {prepared.files.map((file) => (
                <li key={file.id}>
                  <span>{file.name}</span>
                  <small>{plural(file.frameCount, "frame")}</small>
                </li>
              ))}
            </ol>
          </details>
        )}
        {timingNote && (
          <p className="display-format-note" role="note">
            {timingNote}
          </p>
        )}
        {uploading ? (
          <button
            type="button"
            className="secondary-action"
            onClick={() => uploadAbort.current?.abort()}
          >
            Cancel upload
          </button>
        ) : (
          <button
            type="button"
            className="primary-action"
            aria-label="Upload image to keyboard"
            disabled={!connected || !prepared || activeOperation !== null || processing}
            onClick={onUpload}
          >
            Send to keyboard
          </button>
        )}
        {!connected && prepared && (
          <p className="display-format-note">Connect your keyboard on the Device tab to send.</p>
        )}
        <p className="display-format-note">
          Multiple images play in order. Still images show for 0.5 seconds each; up to{" "}
          {MAX_TFT_FRAMES} frames.
        </p>
        {uploading && (
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

/** Explain any frames whose timing had to change to fit the keyboard's limits. */
function describeTiming({ extendedFrames, shortenedFrames }: PreparedImages): string | null {
  const notes: string[] = [];
  if (extendedFrames > 0) {
    const [verb, their] = extendedFrames === 1 ? ["was", "its"] : ["were", "their"];
    notes.push(
      `${plural(extendedFrames, "long frame")} ${verb} repeated to keep ${their} original timing.`,
    );
  }
  if (shortenedFrames > 0) {
    notes.push(
      `${plural(shortenedFrames, "frame")} will show for 0.51 s, the longest the keyboard supports, because the 255-frame limit was reached.`,
    );
  }
  return notes.length > 0 ? notes.join(" ") : null;
}

function drawPreview(canvas: HTMLCanvasElement | null, rgb565: Uint8Array) {
  const context = canvas?.getContext("2d");
  if (!context) return;
  const image = context.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
  rgb565ToRgba(rgb565, image.data);
  context.putImageData(image, 0, 0);
}
