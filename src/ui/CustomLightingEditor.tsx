import { useEffect, useRef, useState } from "preact/hooks";
import { useDeviceSession } from "../device/DeviceSession";
import { hexToRgb } from "../lighting/color";
import { applyCustomLighting } from "../lighting/custom";
import { CUSTOM_LED_COUNT } from "../protocol/constants";
import type { RGBColor } from "../protocol/lighting";
import { errorMessage } from "./text";

const BLACK: RGBColor = { red: 0, green: 0, blue: 0 };
// The firmware falls back to its saved preset shortly after the last custom
// table. Keep some margin below the ~130 ms cadence seen in the OEM driver.
const CUSTOM_REFRESH_INTERVAL_MS = 100;
const emptyColors = () => Array.from({ length: CUSTOM_LED_COUNT }, () => ({ ...BLACK }));

export function useCustomLightingEditor(active = true) {
  const { connected, activeOperation, runOperation } = useDeviceSession();
  const [colors, setColors] = useState<RGBColor[]>(emptyColors);
  const [paintColor, setPaintColor] = useState("#ff0000");
  const [status, setStatus] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const colorsRef = useRef(colors);
  const lastTransferStartedAt = useRef<number | null>(null);
  colorsRef.current = colors;
  const available = connected;
  const busy = activeOperation !== null;
  // Stopping only cancels the local refresh loop, so it remains safe while
  // the current custom RGB transfer holds the shared device-operation lock.
  const actionDisabled = !streaming && (!available || busy);

  useEffect(() => {
    if (!active) setStreaming(false);
  }, [active]);

  useEffect(() => {
    if (!active || !streaming || !available) return;

    let cancelled = false;
    let timer: number | undefined;

    const pump = async () => {
      const startedAt = performance.now();
      lastTransferStartedAt.current = startedAt;
      try {
        await runOperation(
          "custom RGB",
          (operationController) => applyCustomLighting(operationController, colorsRef.current),
          // Streaming holds the device lock without re-rendering the whole
          // app ten times a second; the Stop button reflects `streaming`.
          { background: true },
        );
      } catch (error) {
        if (!cancelled) {
          setStreaming(false);
          setStatus(errorMessage(error, "Custom RGB operation failed."));
        }
        return;
      }

      if (cancelled) return;
      const remaining = Math.max(0, CUSTOM_REFRESH_INTERVAL_MS - (performance.now() - startedAt));
      timer = window.setTimeout(pump, remaining);
    };

    const elapsed = performance.now() - (lastTransferStartedAt.current ?? -Infinity);
    timer = window.setTimeout(pump, Math.max(0, CUSTOM_REFRESH_INTERVAL_MS - elapsed));
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [active, available, runOperation, streaming]);

  const paint = (keyIds: readonly number[], color = hexToRgb(paintColor)) => {
    setColors((current) => {
      const next = current.map((value) => ({ ...value }));
      for (const keyId of keyIds) next[keyId] = { ...color };
      return next;
    });
  };

  const applyToKeyboard = async () => {
    setStatus("Applying custom RGB…");
    try {
      lastTransferStartedAt.current = performance.now();
      await runOperation("custom RGB", (operationController) =>
        applyCustomLighting(operationController, colors),
      );
      setStreaming(true);
      setStatus("Live custom RGB active. Keep the Per-key panel open.");
    } catch (error) {
      setStatus(errorMessage(error, "Custom RGB operation failed."));
    }
  };

  const controls = (
    <section className="custom-lighting" aria-labelledby="custom-lighting-title">
      <div className="custom-lighting-heading">
        <div>
          <p className="eyebrow">Per-key mode · live lighting</p>
          <h3 id="custom-lighting-title">Custom per-key RGB</h3>
          <p>Choose one color and paint keys directly on the preview.</p>
        </div>
        <span className={`capability-badge ${available ? "is-available" : ""}`}>
          {available ? "Wired interface ready" : "Connect keyboard to apply"}
        </span>
      </div>

      <p className="effect-behavior" role="note">
        The keyboard does not store custom per-key layouts, so this page streams your colors while
        Per-key is open and this tab is in front. Browsers slow background tabs, so the keyboard
        returns to its saved effect if you switch away, stop live RGB or leave Per-key.
      </p>

      <div className="custom-simple-tools">
        <label className="custom-color-control">
          Paint color
          <span>
            <input
              aria-label="Custom paint color"
              type="color"
              value={paintColor}
              onInput={(event) => setPaintColor(event.currentTarget.value)}
            />
            <strong>{paintColor.toUpperCase()}</strong>
          </span>
        </label>
        <button
          type="button"
          onClick={() => paint(Array.from({ length: CUSTOM_LED_COUNT }, (_, id) => id))}
        >
          Fill all
        </button>
        <button
          type="button"
          onClick={() =>
            paint(
              Array.from({ length: CUSTOM_LED_COUNT }, (_, id) => id),
              BLACK,
            )
          }
        >
          Clear all
        </button>
      </div>

      <div className="custom-apply-actions">
        <button
          type="button"
          className="primary-action"
          disabled={actionDisabled}
          onClick={streaming ? () => setStreaming(false) : applyToKeyboard}
        >
          {streaming ? "Stop live RGB" : "Apply custom RGB"}
        </button>
      </div>
      {status && (
        <p className="lighting-feedback" role="status">
          {status}
        </p>
      )}
    </section>
  );

  return {
    keyboard: {
      colors,
      onKey: (keyId: number) => paint([keyId]),
      onPaintKey: (keyId: number) => paint([keyId]),
    },
    controls,
  };
}
