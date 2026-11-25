import { MAX_TFT_FRAMES } from "../protocol/constants";
import { isAnimatedWebP, processAnimatedImage } from "./animated";
import { processStaticImage } from "./static";
import { fitFrameTiming } from "./timing";

/** A selection of image files, converted to RGB565 frames ready to upload. */
export type PreparedImages = {
  frames: Uint8Array[];
  delaysMs: number[];
  files: { id: string; name: string; frameCount: number }[];
  /**
   * One still image. It is uploaded without frame delays, so the keyboard
   * shows it permanently instead of as a one-frame animation.
   */
  isSingleStill: boolean;
  /** Frames whose hold time was kept by repeating them. */
  extendedFrames: number;
  /** Frames cut to the longest hold the keyboard supports, because the frame limit was reached. */
  shortenedFrames: number;
};

/** How long each still image shows when several are combined into an animation. */
export const STILL_FRAME_DELAY_MS = 500;
const MAX_SELECTION_BYTES = 50 * 1024 * 1024;

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};
const SUPPORTED_MIME_TYPES = new Set(Object.values(MIME_TYPE_BY_EXTENSION));

/**
 * Decode every selected file in order and combine their frames into one
 * animation. Errors are thrown with a message ready to show the user, naming
 * the file at fault when there is more than one.
 */
export async function prepareImages(selectedFiles: readonly File[]): Promise<PreparedImages> {
  if (selectedFiles.length > MAX_TFT_FRAMES) {
    throw new Error(`Choose no more than ${MAX_TFT_FRAMES} files at once.`);
  }
  const selectionBytes = selectedFiles.reduce((total, file) => total + file.size, 0);
  if (selectionBytes > MAX_SELECTION_BYTES) {
    throw new Error("The selected files exceed the combined 50 MB limit.");
  }

  const frames: Uint8Array[] = [];
  const delaysMs: number[] = [];
  const files: PreparedImages["files"] = [];
  for (const file of selectedFiles) {
    let decoded: { frames: Uint8Array[]; delaysMs: number[] };
    try {
      decoded = await decodeImageFile(withImageType(file));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "It could not be read.";
      throw new Error(selectedFiles.length === 1 ? reason : `“${file.name}”: ${reason}`);
    }
    frames.push(...decoded.frames);
    delaysMs.push(...decoded.delaysMs);
    files.push({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      frameCount: decoded.frames.length,
    });
    if (frames.length > MAX_TFT_FRAMES) {
      throw new Error(
        `The selection contains ${frames.length} frames; the keyboard supports at most ${MAX_TFT_FRAMES}.`,
      );
    }
  }
  if (frames.length === 0) throw new Error("Choose at least one image.");

  const isSingleStill = selectedFiles.length === 1 && frames.length === 1;
  if (isSingleStill) {
    return { frames, delaysMs, files, isSingleStill, extendedFrames: 0, shortenedFrames: 0 };
  }
  return { ...fitFrameTiming(frames, delaysMs), files, isSingleStill };
}

async function decodeImageFile(file: File): Promise<{ frames: Uint8Array[]; delaysMs: number[] }> {
  const animated =
    file.type === "image/gif" || (file.type === "image/webp" && (await isAnimatedWebP(file)));
  if (animated) return processAnimatedImage(file);
  return { frames: [await processStaticImage(file)], delaysMs: [STILL_FRAME_DELAY_MS] };
}

/** Some systems give files no MIME type; fall back to the file extension. */
function withImageType(file: File): File {
  if (SUPPORTED_MIME_TYPES.has(file.type)) return file;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const type = MIME_TYPE_BY_EXTENSION[extension];
  if (!type) throw new Error("Unsupported image type. Choose a PNG, JPEG, WebP or GIF image.");
  return new File([file], file.name, { type, lastModified: file.lastModified });
}
