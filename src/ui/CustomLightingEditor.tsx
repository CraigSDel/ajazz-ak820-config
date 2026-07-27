import { useEffect, useRef, useState } from "react";
import { useDeviceSession } from "../device/DeviceSession";
import { applyCustomLighting, canUseCustomLighting } from "../lighting/custom";
import { hexToRgb } from "../lighting/color";
import { CUSTOM_LED_COUNT } from "../protocol/constants";
import type { RGBColor } from "../protocol/lighting";
import { LightingKeyboard } from "./LightingKeyboard";

const BLACK: RGBColor = { red: 0, green: 0, blue: 0 };
// The firmware falls back to its saved preset shortly after the last custom
// table. Keep some margin below the ~130 ms cadence seen in the OEM driver.
const CUSTOM_REFRESH_INTERVAL_MS = 100;
const emptyColors = () => Array.from({ length: CUSTOM_LED_COUNT }, () => ({ ...BLACK }));

export function useCustomLightingEditor(active = true) {
  const { controller, connected, activeOperation, runOperation } = useDeviceSession();
  const [colors, setColors] = useState<RGBColor[]>(emptyColors);
  const [paintColor, setPaintColor] = useState("#ff0000");
  const [status, setStatus] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const colorsRef = useRef(colors);
  const lastTransferStartedAt = useRef<number | null>(null);
  colorsRef.current = colors;
  const available = connected && canUseCustomLighting(controller);
  const busy = activeOperation !== null;

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
        await runOperation("custom RGB", (operationController) =>
          applyCustomLighting(operationController, colorsRef.current),
        );
      } catch (error) {
        if (!cancelled) {
          setStreaming(false);
          setStatus(message(error));
        }
        return;
      }

      if (cancelled) return;
      const remaining = Math.max(
        0,
        CUSTOM_REFRESH_INTERVAL_MS - (performance.now() - startedAt),
      );
      timer = window.setTimeout(pump, remaining);
    };

    const elapsed = performance.now() - (lastTransferStartedAt.current ?? -Infinity);
    timer = window.setTimeout(pump, Math.max(0, CUSTOM_REFRESH_INTERVAL_MS - elapsed));
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [active, available, runOperation, streaming]);

  const paint = (ledIds: readonly number[], color = hexToRgb(paintColor)) => {
    setColors((current) => {
      const next = current.map((value) => ({ ...value }));
      for (const ledId of ledIds) next[ledId] = { ...color };
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
      setStatus(message(error));
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
        The keyboard does not store custom per-key layouts. Keep this panel open to stream your
        colors; stopping live RGB or leaving Per-key restores the keyboard&apos;s saved preset.
      </p>

      <div className="custom-simple-tools">
        <label className="custom-color-control">
          Paint color
          <span>
            <input
              aria-label="Custom paint color"
              type="color"
              value={paintColor}
              onChange={(event) => setPaintColor(event.target.value)}
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
          disabled={!available || busy}
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
      onKey: (ledId: number) => paint([ledId]),
      onPaintKey: (ledId: number) => paint([ledId]),
    },
    controls,
  };
}

export function CustomLightingEditor() {
  const editor = useCustomLightingEditor();
  return (
    <>
      <LightingKeyboard mode="per-key" {...editor.keyboard} />
      {editor.controls}
    </>
  );
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Custom RGB operation failed.";
}
