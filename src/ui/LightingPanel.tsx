import { type CSSProperties, useMemo, useRef, useState } from "react";
import { useDeviceSession } from "../device/DeviceSession";
import { setLighting, setLightingSleepTime } from "../operations";
import {
  type LightingConfig,
  type LightingDirection,
  type LightingLevel,
  LightingMode,
} from "../protocol/lighting";
import { LightingSleepTime, type LightingSleepTime as SleepTime } from "../protocol/lighting-sleep";
import { effectForMode, LIGHTING_EFFECTS } from "../lighting/effects";
import { hexToRgb, rgbToHex } from "../lighting/color";
import { DEFAULT_LIGHTING_CONFIG } from "../lighting/default-config";
import { useCustomLightingEditor } from "./CustomLightingEditor";
import { LightingKeyboard, type LightingKeyboardProps } from "./LightingKeyboard";

const COLOR_PRESETS = [
  "#ff3b30",
  "#ff9500",
  "#ffd60a",
  "#34c759",
  "#00c7be",
  "#0a84ff",
  "#5e5ce6",
  "#bf5af2",
];

export function LightingPanel() {
  const { controller, connected, activeOperation, runOperation } = useDeviceSession();
  const [config, setConfig] = useState<LightingConfig>(DEFAULT_LIGHTING_CONFIG);
  const [appliedConfig, setAppliedConfig] = useState<LightingConfig | null>(null);
  const [sleepTime, setSleepTime] = useState<SleepTime>(LightingSleepTime.Never);
  const [status, setStatus] = useState<string | null>(null);
  const [sleepStatus, setSleepStatus] = useState<string | null>(null);
  const [editingMode, setEditingMode] = useState<"effects" | "per-key">("effects");
  const directionOptions = useMemo(() => directionsForMode(config.mode), [config.mode]);
  const selectedEffect = effectForMode(config.mode);
  const customEditor = useCustomLightingEditor(editingMode === "per-key");
  const busy = activeOperation !== null;
  const applyingLighting = activeOperation === "lighting";
  const hasChanges = !appliedConfig || !sameLightingConfig(config, appliedConfig);
  const keyboardProps: LightingKeyboardProps =
    editingMode === "effects"
      ? { mode: "effect", config }
      : { mode: "per-key", ...customEditor.keyboard };

  const updateConfig = <K extends keyof LightingConfig>(key: K, value: LightingConfig[K]) =>
    setConfig((current) => ({ ...current, [key]: value }));

  const changeMode = (mode: LightingMode) => {
    setConfig((current) => configForMode(current, mode));
  };

  const applyConfig = async (nextConfig: LightingConfig) => {
    setStatus("Applying lighting…");
    try {
      await runOperation("lighting", () => setLighting(controller, nextConfig));
      setAppliedConfig({ ...nextConfig, color: { ...nextConfig.color } });
      setStatus(`Lighting applied to AK820 Pro · mode ${nextConfig.mode}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Lighting update failed");
    }
  };

  const applyLighting = () => applyConfig(config);

  const applySleep = async () => {
    setSleepStatus("Applying sleep timeout…");
    try {
      await runOperation("lighting sleep", () => setLightingSleepTime(controller, sleepTime));
      setSleepStatus("Sleep timeout applied");
    } catch (error) {
      setSleepStatus(error instanceof Error ? error.message : "Sleep timeout update failed");
    }
  };

  return (
    <section className="panel lighting-panel">
      <div className="lighting-page-toolbar">
        <div>
          <p className="eyebrow">Lighting workspace</p>
          <p className="lighting-page-copy">
            Choose a numbered effect or paint an exact static layout on the same keyboard.
          </p>
        </div>
        <fieldset className="lighting-mode-switch">
          <legend className="visually-hidden">Lighting editing mode</legend>
          <button
            type="button"
            className={editingMode === "effects" ? "is-active" : ""}
            aria-pressed={editingMode === "effects"}
            onClick={() => setEditingMode("effects")}
          >
            Effects
          </button>
          <button
            type="button"
            className={editingMode === "per-key" ? "is-active" : ""}
            aria-pressed={editingMode === "per-key"}
            onClick={() => setEditingMode("per-key")}
          >
            Per-key
          </button>
        </fieldset>
      </div>
      <LightingKeyboard {...keyboardProps} />
      <p className="keyboard-context">
        {editingMode === "effects" ? (
          <>
            Color and brightness preview only · effect motion is shown on the physical keyboard ·
            changes are sent only when you apply them.
          </>
        ) : (
          "Click or drag to paint · use arrow keys to move · Apply starts live RGB."
        )}
      </p>
      {editingMode === "effects" ? (
        <div className="lighting-editor">
          <fieldset className="lighting-controls settings-card" disabled={busy}>
            <div className="settings-card-heading">
              <div>
                <p className="eyebrow">Keyboard effect</p>
                <h3>Choose an effect</h3>
              </div>
              <span className={`draft-state ${hasChanges ? "is-dirty" : "is-saved"}`}>
                {hasChanges ? "Not applied" : "Applied"}
              </span>
            </div>
            <EffectPicker selected={selectedEffect} onChange={changeMode} />
            {!selectedEffect.supportsColor && config.mode !== LightingMode.Off && (
              <p className="effect-behavior" role="note">
                Fixed-palette effect — this animation chooses its own colors.
              </p>
            )}
            {selectedEffect.supportsColor && (
              <fieldset className="control-color">
                <legend>Color</legend>
                <div className="color-picker-control">
                  <input
                    className="lighting-color-input"
                    aria-label="Lighting color"
                    type="color"
                    value={rgbToHex(config.color)}
                    onChange={(event) => updateConfig("color", hexToRgb(event.target.value))}
                  />
                  <span>
                    <strong>{rgbToHex(config.color).toUpperCase()}</strong>
                    <small>Custom color</small>
                  </span>
                </div>
                <fieldset className="color-presets">
                  <legend className="visually-hidden">Color presets</legend>
                  {COLOR_PRESETS.map((color) => (
                    <button
                      type="button"
                      className={rgbToHex(config.color) === color ? "is-active" : ""}
                      style={{ "--swatch-color": color } as CSSProperties}
                      aria-label={`Use color ${color}`}
                      aria-pressed={rgbToHex(config.color) === color}
                      onClick={() => updateConfig("color", hexToRgb(color))}
                      key={color}
                    />
                  ))}
                </fieldset>
              </fieldset>
            )}
            {selectedEffect.supportsPalette && (
              <label className="checkbox-label control-rainbow">
                <input
                  type="checkbox"
                  checked={config.rainbow}
                  onChange={(event) => updateConfig("rainbow", event.target.checked)}
                />
                Built-in multicolor palette
              </label>
            )}
            {config.mode !== LightingMode.Off && (
              <LevelSelect
                label="Brightness"
                value={config.brightness}
                onChange={(value) => updateConfig("brightness", value)}
              />
            )}
            {selectedEffect.supportsSpeed && (
              <LevelSelect
                label="Speed"
                value={config.speed}
                onChange={(value) => updateConfig("speed", value)}
              />
            )}
            {directionOptions.length > 0 && (
              <label>
                Direction
                <select
                  aria-label="Direction"
                  value={config.direction}
                  onChange={(event) =>
                    updateConfig("direction", Number(event.target.value) as LightingDirection)
                  }
                >
                  {directionOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="lighting-apply-bar">
              <span>
                {connected
                  ? hasChanges
                    ? "Your preview has changes that are not on the keyboard yet."
                    : "The keyboard is using these settings."
                  : "Connect your keyboard to send these settings."}
              </span>
              <button
                type="button"
                className="primary-action"
                disabled={!connected || busy || !hasChanges}
                aria-busy={applyingLighting}
                onClick={applyLighting}
              >
                {applyingLighting ? "Applying…" : hasChanges ? "Apply to keyboard" : "Applied"}
              </button>
            </div>
            {status && (
              <p
                className="lighting-feedback settings-card-feedback"
                role="status"
                aria-live="polite"
              >
                {status}
              </p>
            )}
          </fieldset>

          <div className="subsection sleep-section">
            <p className="eyebrow">Power saving</p>
            <h3>Lighting sleep</h3>
            <label>
              Turn lighting off after
              <select
                aria-label="Lighting sleep timeout"
                value={sleepTime}
                disabled={busy}
                onChange={(event) => setSleepTime(Number(event.target.value) as SleepTime)}
              >
                <option value={LightingSleepTime.Never}>Never</option>
                <option value={LightingSleepTime.OneMinute}>1 minute</option>
                <option value={LightingSleepTime.FiveMinutes}>5 minutes</option>
                <option value={LightingSleepTime.ThirtyMinutes}>30 minutes</option>
              </select>
            </label>
            <button type="button" disabled={!connected || busy} onClick={applySleep}>
              Apply sleep timeout
            </button>
            {sleepStatus && (
              <p className="lighting-feedback" role="status" aria-live="polite">
                {sleepStatus}
              </p>
            )}
          </div>
        </div>
      ) : null}
      {editingMode === "per-key" ? customEditor.controls : null}
    </section>
  );
}

function sameLightingConfig(a: LightingConfig, b: LightingConfig): boolean {
  return (
    a.mode === b.mode &&
    a.color.red === b.color.red &&
    a.color.green === b.color.green &&
    a.color.blue === b.color.blue &&
    a.rainbow === b.rainbow &&
    a.brightness === b.brightness &&
    a.speed === b.speed &&
    a.direction === b.direction
  );
}

function EffectPicker({
  selected,
  onChange,
}: {
  selected: (typeof LIGHTING_EFFECTS)[number];
  onChange(mode: LightingMode): void;
}) {
  const picker = useRef<HTMLDetailsElement>(null);

  return (
    <fieldset className="control-effect">
      <legend>Effect</legend>
      <details className="effect-picker" ref={picker}>
        <summary aria-label="Lighting effect">
          <EffectGlyph preview={selected.preview} />
          <span>
            <strong>{selected.displayName}</strong>
            <small>{selected.description}</small>
          </span>
          <span className="effect-picker-chevron" aria-hidden="true" />
        </summary>
        <fieldset className="effect-options">
          <legend className="visually-hidden">Available lighting effects</legend>
          {LIGHTING_EFFECTS.map((effect) => (
            <button
              type="button"
              aria-label={effect.displayName}
              className={
                effect.protocolId === selected.protocolId
                  ? "effect-option is-active"
                  : "effect-option"
              }
              aria-pressed={effect.protocolId === selected.protocolId}
              onClick={() => {
                onChange(effect.protocolId);
                if (picker.current) picker.current.open = false;
              }}
              key={effect.protocolId}
            >
              <EffectGlyph preview={effect.preview} />
              <span>
                <strong>{effect.displayName}</strong>
                <small>{effect.description}</small>
              </span>
            </button>
          ))}
        </fieldset>
      </details>
    </fieldset>
  );
}

function EffectGlyph({ preview }: { preview: (typeof LIGHTING_EFFECTS)[number]["preview"] }) {
  return <span className={`effect-glyph is-${preview}`} aria-hidden="true" />;
}

function LevelSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: LightingLevel;
  onChange(value: LightingLevel): void;
}) {
  return (
    <label className="range-control">
      <span>
        {label}
        <span className="range-value" aria-hidden="true">
          {value}
        </span>
      </span>
      <input
        aria-label={label}
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) as LightingLevel)}
      />
    </label>
  );
}

function directionsForMode(mode: LightingMode): readonly (readonly [LightingDirection, string])[] {
  return effectForMode(mode).directions;
}

function configForMode(config: LightingConfig, mode: LightingMode): LightingConfig {
  const supportedDirections = directionsForMode(mode);
  return {
    ...config,
    mode,
    direction: supportedDirections[0]?.[0] ?? config.direction,
  };
}
