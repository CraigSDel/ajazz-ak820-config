import { MAX_FRAME_DELAY_MS, MAX_TFT_FRAMES } from "../protocol/constants";

export type FittedTiming = {
  frames: Uint8Array[];
  delaysMs: number[];
  /** Frames whose hold time was preserved by repeating them. */
  extendedFrames: number;
  /** Frames shortened to the header maximum because the frame budget ran out. */
  shortenedFrames: number;
};

/**
 * The upload header stores each delay in one byte of 2 ms units, so a frame
 * can be held for at most 510 ms. Preserve longer holds (common in GIFs) by
 * repeating the frame, as long as the 255-frame budget allows.
 */
export function fitFrameTiming(
  frames: readonly Uint8Array[],
  delaysMs: readonly number[],
  maxFrames = MAX_TFT_FRAMES,
): FittedTiming {
  let budget = maxFrames - frames.length;
  const fittedFrames: Uint8Array[] = [];
  const fittedDelays: number[] = [];
  let extendedFrames = 0;
  let shortenedFrames = 0;

  frames.forEach((frame, index) => {
    const delay = delaysMs[index];
    if (delay <= MAX_FRAME_DELAY_MS) {
      fittedFrames.push(frame);
      fittedDelays.push(delay);
      return;
    }
    const copies = Math.ceil(delay / MAX_FRAME_DELAY_MS);
    if (copies - 1 <= budget) {
      budget -= copies - 1;
      extendedFrames += 1;
      const perCopy = delay / copies;
      for (let copy = 0; copy < copies; copy++) {
        fittedFrames.push(frame);
        fittedDelays.push(perCopy);
      }
    } else {
      shortenedFrames += 1;
      fittedFrames.push(frame);
      fittedDelays.push(MAX_FRAME_DELAY_MS);
    }
  });

  return { frames: fittedFrames, delaysMs: fittedDelays, extendedFrames, shortenedFrames };
}
