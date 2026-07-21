import { useState } from "react";
import { useDeviceSession } from "../device/DeviceSession";
import {
  applyCustomLighting,
  canUseCustomLighting,
  readCustomLighting,
  restoreCustomLighting,
  type CustomLightingBackup,
} from "../lighting/custom";
import { AK820_KEY_GROUPS } from "../lighting/keyboard-layout";
import { hexToRgb } from "../lighting/color";
import {
  parseLightingProfile,
  profileStorageKey,
  serializeLightingProfile,
} from "../lighting/profiles";
import { CUSTOM_LIGHTING_PRESETS } from "../lighting/presets";
import { CUSTOM_LED_COUNT } from "../protocol/custom-lighting";
import type { RGBColor } from "../protocol/lighting";
import { LightingKeyboard } from "./LightingKeyboard";

const BLACK: RGBColor = { red: 0, green: 0, blue: 0 };
const EMPTY_COLORS = Array.from({ length: CUSTOM_LED_COUNT }, () => ({ ...BLACK }));

export function useCustomLightingEditor() {
  const { controller, connected, activeOperation, runOperation } = useDeviceSession();
  const [history, setHistory] = useState<RGBColor[][]>([EMPTY_COLORS]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const colors = history[historyIndex];
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [paintColor, setPaintColor] = useState("#ff0000");
  const [recentColors, setRecentColors] = useState(["#ff0000"]);
  const [gradientColor, setGradientColor] = useState("#0000ff");
  const [brightness, setBrightness] = useState(6);
  const [acknowledged, setAcknowledged] = useState(false);
  const [backup, setBackup] = useState<CustomLightingBackup | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("My layout");
  const [selectedProfile, setSelectedProfile] = useState("");
  const [, setProfileRevision] = useState(0);
  const available = connected && canUseCustomLighting(controller);
  const identity = controller.getIdentity();
  const busy = activeOperation !== null;
  const storedProfiles = listStoredProfiles();

  const commit = (next: RGBColor[]) => {
    setHistory((current) => [
      ...current.slice(Math.max(0, historyIndex - 48), historyIndex + 1),
      next,
    ]);
    setHistoryIndex((current) => Math.min(current + 1, 49));
  };

  const paintIds = (ids: readonly number[], color = hexToRgb(paintColor)) => {
    if (ids.length === 0) return;
    const next = colors.map((value) => ({ ...value }));
    for (const id of ids) next[id] = { ...color };
    commit(next);
  };

  const rememberColor = (color: string) => {
    setPaintColor(color);
    setRecentColors((current) => [color, ...current.filter((item) => item !== color)].slice(0, 6));
  };

  const onKey = (ledId: number, additive: boolean) => {
    if (additive) {
      setSelection((current) => {
        const next = new Set(current);
        next.has(ledId) ? next.delete(ledId) : next.add(ledId);
        return next;
      });
      return;
    }
    setSelection(new Set([ledId]));
    paintIds([ledId]);
  };

  const applyGradient = () => {
    const ids = [...(selection.size ? selection : new Set(AK820_KEY_GROUPS.All))].sort(
      (a, b) => a - b,
    );
    const start = hexToRgb(paintColor);
    const end = hexToRgb(gradientColor);
    const next = colors.map((value) => ({ ...value }));
    ids.forEach((id, index) => {
      const amount = ids.length <= 1 ? 0 : index / (ids.length - 1);
      next[id] = mix(start, end, amount);
    });
    commit(next);
  };

  const loadFromKeyboard = async () => {
    setStatus("Reading current custom layout…");
    try {
      const result = await runOperation("custom RGB", () => readCustomLighting(controller));
      const next = EMPTY_COLORS.map((color) => ({ ...color }));
      for (const color of result.colors) next[color.ledId] = color;
      commit(next);
      setBackup(result);
      setStatus("Current custom layout loaded and backed up.");
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
      setStatus("Custom RGB applied. The previous keyboard state is available to restore.");
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

  const saveProfile = () => {
    try {
      localStorage.setItem(
        profileStorageKey(profileName),
        serializeLightingProfile(profileName, colors),
      );
      setProfileRevision((revision) => revision + 1);
      setStatus(`Saved profile “${profileName.trim()}”.`);
    } catch (error) {
      setStatus(message(error));
    }
  };

  const loadProfile = (name: string) => {
    const source = localStorage.getItem(profileStorageKey(name));
    if (!source) return;
    try {
      const profile = parseLightingProfile(source);
      setProfileName(profile.name);
      commit(profile.colors);
      setStatus(`Loaded profile “${profile.name}”.`);
    } catch (error) {
      setStatus(message(error));
    }
  };

  const deleteProfile = () => {
    if (!selectedProfile) return;
    localStorage.removeItem(profileStorageKey(selectedProfile));
    setSelectedProfile("");
    setProfileRevision((revision) => revision + 1);
    setStatus(`Deleted local profile “${selectedProfile}”.`);
  };

  const importProfile = async (file: File) => {
    try {
      const profile = parseLightingProfile(await file.text());
      setProfileName(profile.name);
      commit(profile.colors);
      setStatus(`Imported profile “${profile.name}”. Review it before applying.`);
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
          <p>Paint directly on the keyboard. Your draft stays in the browser until you apply it.</p>
        </div>
        <span className={`capability-badge ${available ? "is-available" : ""}`}>
          {available ? "Command interface detected" : "Command interface unavailable"}
        </span>
      </div>
      <details className="device-details">
        <summary>Device details</summary>
        <dl className="rgb-diagnostics">
          <div>
            <dt>Device</dt>
            <dd>{identity?.productName ?? "Not connected"}</dd>
          </div>
          <div>
            <dt>USB ID</dt>
            <dd>{identity ? `${hexId(identity.vendorId)}:${hexId(identity.productId)}` : "—"}</dd>
          </div>
          <div>
            <dt>Custom transport</dt>
            <dd>{available ? "0xFF67 framed commands" : "Not detected"}</dd>
          </div>
          <div>
            <dt>LED map</dt>
            <dd>AK820 ISO · 128 slots</dd>
          </div>
        </dl>
      </details>

      <div className="custom-tools">
        <label>
          Paint color
          <input
            aria-label="Custom paint color"
            type="color"
            value={paintColor}
            onChange={(event) => rememberColor(event.target.value)}
          />
        </label>
        <label>
          Gradient end
          <input
            aria-label="Gradient end color"
            type="color"
            value={gradientColor}
            onChange={(event) => setGradientColor(event.target.value)}
          />
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
      </div>
      <fieldset className="recent-colors">
        <legend className="visually-hidden">Recent custom RGB colors</legend>
        {recentColors.map((color) => (
          <button
            type="button"
            aria-label={`Use ${color}`}
            style={{ background: color }}
            onClick={() => rememberColor(color)}
            key={color}
          />
        ))}
      </fieldset>

      <div className="button-row custom-groups">
        {Object.entries(AK820_KEY_GROUPS).map(([name, ids]) => (
          <button type="button" onClick={() => setSelection(new Set(ids))} key={name}>
            {name}
          </button>
        ))}
      </div>
      <div className="button-row custom-presets">
        {CUSTOM_LIGHTING_PRESETS.map((preset) => (
          <button type="button" onClick={() => commit(preset.create())} key={preset.name}>
            {preset.name}
          </button>
        ))}
      </div>
      <div className="button-row">
        <button type="button" disabled={!selection.size} onClick={() => paintIds([...selection])}>
          Paint selection
        </button>
        <button type="button" onClick={applyGradient}>
          Apply gradient
        </button>
        <button type="button" onClick={() => paintIds(AK820_KEY_GROUPS.All)}>
          Fill all
        </button>
        <button type="button" onClick={() => paintIds(AK820_KEY_GROUPS.All, BLACK)}>
          Clear
        </button>
        <button
          type="button"
          disabled={historyIndex === 0}
          onClick={() => setHistoryIndex((index) => index - 1)}
        >
          Undo
        </button>
        <button
          type="button"
          disabled={historyIndex >= history.length - 1}
          onClick={() => setHistoryIndex((index) => index + 1)}
        >
          Redo
        </button>
      </div>

      <div className="custom-profiles">
        <label>
          Profile name
          <input
            aria-label="Custom RGB profile name"
            value={profileName}
            maxLength={50}
            onChange={(event) => setProfileName(event.target.value)}
          />
        </label>
        <button type="button" onClick={saveProfile}>
          Save locally
        </button>
        <select
          aria-label="Saved custom RGB profiles"
          value={selectedProfile}
          onChange={(event) => {
            setSelectedProfile(event.target.value);
            if (event.target.value) loadProfile(event.target.value);
          }}
        >
          <option value="">Load saved profile…</option>
          {storedProfiles.map((name) => (
            <option value={name} key={name}>
              {name}
            </option>
          ))}
        </select>
        <button type="button" disabled={!selectedProfile} onClick={deleteProfile}>
          Delete local profile
        </button>
        <button type="button" onClick={() => downloadProfile(profileName, colors)}>
          Export JSON
        </button>
        <label className="file-control compact">
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) =>
              event.target.files?.[0] && void importProfile(event.target.files[0])
            }
          />
        </label>
      </div>

      <label className="checkbox-label custom-risk">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        I understand that custom RGB uses an experimental reverse-engineered command and have kept
        the official driver available.
      </label>
      <div className="button-row">
        <button type="button" disabled={!available || busy} onClick={loadFromKeyboard}>
          Read and back up current layout
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
      selection,
      onKey,
      onPaintKey: (ledId: number) => paintIds([ledId]),
    },
    controls,
  };
}

/** Standalone wrapper retained for focused editor tests and reuse outside LightingPanel. */
export function CustomLightingEditor() {
  const editor = useCustomLightingEditor();
  return (
    <>
      <LightingKeyboard mode="per-key" {...editor.keyboard} />
      {editor.controls}
    </>
  );
}

function listStoredProfiles(): string[] {
  if (typeof localStorage === "undefined") return [];
  return Object.keys(localStorage)
    .filter((key) => key.startsWith("ak820-rgb-profile:"))
    .map((key) => key.slice("ak820-rgb-profile:".length))
    .sort();
}

function downloadProfile(name: string, colors: readonly RGBColor[]): void {
  const blob = new Blob([serializeLightingProfile(name, colors)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name.trim().replace(/[^a-z0-9_-]+/gi, "-") || "ak820-rgb"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function mix(start: RGBColor, end: RGBColor, amount: number): RGBColor {
  return {
    red: Math.round(start.red + (end.red - start.red) * amount),
    green: Math.round(start.green + (end.green - start.green) * amount),
    blue: Math.round(start.blue + (end.blue - start.blue) * amount),
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Custom RGB operation failed.";
}
function hexId(value: number): string {
  return value.toString(16).padStart(4, "0");
}
