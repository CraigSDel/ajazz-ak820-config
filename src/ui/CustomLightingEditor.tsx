import { useState } from "react";
import { useDeviceSession } from "../device/DeviceSession";
import {
  applyCustomLighting,
  canUseCustomLighting,
  readCustomLighting,
  restoreCustomLighting,
  type CustomLightingBackup,
} from "../lighting/custom";
import { hexToRgb } from "../lighting/color";
import { CUSTOM_LED_COUNT } from "../protocol/custom-lighting";
import type { RGBColor } from "../protocol/lighting";
import { LightingKeyboard } from "./LightingKeyboard";

const BLACK: RGBColor = { red: 0, green: 0, blue: 0 };
const emptyColors = () => Array.from({ length: CUSTOM_LED_COUNT }, () => ({ ...BLACK }));

export function useCustomLightingEditor() {
  const { controller, connected, activeOperation, runOperation } = useDeviceSession();
  const [colors, setColors] = useState<RGBColor[]>(emptyColors);
  const [paintColor, setPaintColor] = useState("#ff0000");
  const [brightness, setBrightness] = useState(6);
  const [acknowledged, setAcknowledged] = useState(false);
  const [backup, setBackup] = useState<CustomLightingBackup | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const available = connected && canUseCustomLighting(controller);
  const busy = activeOperation !== null;

  const paint = (ledIds: readonly number[], color = hexToRgb(paintColor)) => {
    setColors((current) => {
      const next = current.map((value) => ({ ...value }));
      for (const ledId of ledIds) next[ledId] = { ...color };
      return next;
    });
  };

  const readFromKeyboard = async () => {
    setStatus("Reading current custom layout…");
    try {
      const result = await runOperation("custom RGB", () => readCustomLighting(controller));
      const next = emptyColors();
      for (const color of result.colors) next[color.ledId] = color;
      setColors(next);
      setBackup(result);
      setStatus("Current layout loaded and backed up.");
    } catch (error) {
      setStatus(message(error));
    }
  };

  const applyToKeyboard = async () => {
    setStatus("Applying custom RGB…");
    try {
      const result = await runOperation("custom RGB", () =>
        applyCustomLighting(controller, colors, brightness),
      );
      setBackup(result);
      setStatus("Custom RGB applied.");
    } catch (error) {
      setStatus(message(error));
    }
  };

  const restoreBackup = async () => {
    if (!backup) return;
    setStatus("Restoring previous lighting…");
    try {
      await runOperation("custom RGB", () => restoreCustomLighting(controller, backup));
      setStatus("Previous lighting restored.");
    } catch (error) {
      setStatus(message(error));
    }
  };

  const controls = (
    <section className="custom-lighting" aria-labelledby="custom-lighting-title">
      <div className="custom-lighting-heading">
        <div>
          <p className="eyebrow">Per-key mode · static only</p>
          <h3 id="custom-lighting-title">Custom per-key RGB</h3>
          <p>Choose one color and paint keys directly on the preview.</p>
        </div>
        <span className={`capability-badge ${available ? "is-available" : ""}`}>
          {available ? "Command interface detected" : "Command interface unavailable"}
        </span>
      </div>

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
        <label>
          Brightness
          <select
            aria-label="Custom RGB brightness"
            value={brightness}
            onChange={(event) => setBrightness(Number(event.target.value))}
          >
            {[1, 2, 3, 4, 5, 6].map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
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

      <label className="checkbox-label custom-risk">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        I understand that custom RGB uses a reverse-engineered command and have kept the official
        driver available.
      </label>

      <div className="custom-apply-actions">
        <button type="button" disabled={!available || busy} onClick={readFromKeyboard}>
          Read current layout
        </button>
        <button
          type="button"
          className="primary-action"
          disabled={!available || !acknowledged || busy}
          onClick={applyToKeyboard}
        >
          Apply custom RGB
        </button>
        <button type="button" disabled={!available || !backup || busy} onClick={restoreBackup}>
          Restore previous lighting
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
