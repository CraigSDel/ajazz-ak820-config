import type { CSSProperties } from "preact";
import { useRef, useState } from "preact/hooks";
import { useDeviceSession } from "../device/DeviceSession";
import { hexToRgb, rgbToHex } from "../lighting/color";
import { DEFAULT_LIGHTING_CONFIG } from "../lighting/default-config";
import { configForEffect, effectForMode, LIGHTING_EFFECTS } from "../lighting/effects";
import { loadSentLighting, rememberSentLighting } from "../lighting/storage";
import { setLighting, setLightingSleepTime } from "../operations";
import {
  type LightingConfig,
  type LightingDirection,
  type LightingLevel,
  LightingMode,
} from "../protocol/lighting";
import { LightingSleepTime, type LightingSleepTime as SleepTime } from "../protocol/lighting-sleep";
import { useCustomLightingEditor } from "./CustomLightingEditor";
import { LightingKeyboard, type LightingKeyboardProps } from "./LightingKeyboard";
import { classNames, errorMessage } from "./text";

type LightingEffect = (typeof LIGHTING_EFFECTS)[number];

// The keyboard's own Fn+→ colour cycle (user manual), as full-saturation LED
// values. The firmware's exact orange and purple values are unconfirmed.
const COLOR_PRESETS = [
  ["Red", "#ff0000"],
  ["Orange", "#ff8000"],
  ["Yellow", "#ffff00"],
  ["Green", "#00ff00"],
  ["Cyan", "#00ffff"],
  ["Blue", "#0000ff"],
  ["Purple", "#8000ff"],
  ["White", "#ffffff"],
] as const;

const EDITING_MODES = [
  ["effects", "Effects"],
  ["per-key", "Per-key"],
] as const;
type EditingMode = (typeof EDITING_MODES)[number][0];

export function LightingPanel() {
  const { connected, activeOperation, runOperation } = useDeviceSession();
  // The keyboard can't be queried, so start from what this browser last sent.
  const [lastSent] = useState(loadSentLighting);
  const [config, setConfig] = useState<LightingConfig>(() =>
    configForEffect(lastSent.config ?? DEFAULT_LIGHTING_CONFIG),
  );
  const [appliedConfig, setAppliedConfig] = useState<LightingConfig | null>(
    lastSent.config ?? null,
  );
  const [status, setStatus] = useState<string | null>(null);
  const [editingMode, setEditingMode] = useState<EditingMode>("effects");
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
    setConfig((current) => configForEffect({ ...current, mode }));
  };

  const applyLighting = async () => {
    // The button exposes the in-progress state. Keep the live region for the
    // outcome so the same update is not announced twice.
    setStatus(null);
    try {
      await runOperation("lighting", (operationController) =>
        setLighting(operationController, config),
      );
      const sent = { ...config, color: { ...config.color } };
      setAppliedConfig(sent);
      rememberSentLighting({ config: sent });
      setStatus(`Lighting applied · ${selectedEffect.displayName}`);
    } catch (error) {
      setStatus(errorMessage(error, "Lighting update failed"));
    }
  };

  let applyHint = "Connect your keyboard to send these settings.";
  if (connected) {
    applyHint = hasChanges
      ? "Your preview has changes that haven't been sent yet."
      : "These are the last settings sent from this browser.";
  }
  let applyLabel = hasChanges ? "Apply to keyboard" : "Reapply to keyboard";
  if (applyingLighting) applyLabel = "Applying…";

  return (
    <section className="panel lighting-panel lighting-workbench">
      <div className="lighting-page-toolbar">
        <div>
          <p className="eyebrow">Lighting workspace</p>
          <p className="lighting-page-copy">
            Choose a numbered effect or paint an exact static layout on the same keyboard.
          </p>
        </div>
        <fieldset className="lighting-mode-switch">
          <legend className="visually-hidden">Lighting editing mode</legend>
          {EDITING_MODES.map(([mode, label]) => (
            <button
              type="button"
              className={classNames(editingMode === mode && "is-active")}
              aria-pressed={editingMode === mode}
              onClick={() => setEditingMode(mode)}
              key={mode}
            >
              {label}
            </button>
          ))}
        </fieldset>
      </div>
      <LightingKeyboard {...keyboardProps} />
      <p className="keyboard-context">
        {editingMode === "effects" ? (
          <>
            The preview approximates each animation · nothing is sent until you apply.
            <span className="mobile-pan-hint"> Swipe sideways to inspect every key.</span>
          </>
        ) : (
          <>
            Click or drag to paint · use arrow keys to move · Apply starts live RGB.
            <span className="mobile-pan-hint"> Swipe sideways to reach every key.</span>
          </>
        )}
      </p>
      {editingMode === "effects" && (
        <div className="lighting-editor">
          <fieldset className="lighting-controls settings-card" disabled={busy}>
            <div className="settings-card-heading">
              <div>
                <p className="eyebrow">Keyboard effect</p>
                <h3>Choose an effect</h3>
              </div>
              <span className={`draft-state ${hasChanges ? "is-dirty" : "is-saved"}`}>
                {hasChanges ? "Not sent" : "Last sent"}
              </span>
            </div>
            <EffectPicker selected={selectedEffect} onChange={changeMode} />
            {!selectedEffect.supportsColor && config.mode !== LightingMode.Off && (
              <p className="effect-behavior" role="note">
                Fixed-palette effect — this animation chooses its own colors.
              </p>
            )}
            {selectedEffect.supportsColor && (
              <ColorControl
                color={rgbToHex(config.color)}
                onChange={(hex) => updateConfig("color", hexToRgb(hex))}
              />
            )}
            {selectedEffect.supportsPalette && (
              <label className="checkbox-label control-rainbow">
                <input
                  type="checkbox"
                  checked={config.rainbow}
                  onChange={(event) => updateConfig("rainbow", event.currentTarget.checked)}
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
            {selectedEffect.directions.length > 0 && (
              <label>
                Direction
                <select
                  aria-label="Direction"
                  value={config.direction}
                  onChange={(event) =>
                    updateConfig(
                      "direction",
                      Number(event.currentTarget.value) as LightingDirection,
                    )
                  }
                >
                  {selectedEffect.directions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="lighting-apply-bar">
              <span>{applyHint}</span>
              <button
                type="button"
                className="primary-action"
                disabled={!connected || busy}
                aria-busy={applyingLighting}
                onClick={applyLighting}
              >
                {applyLabel}
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

          <LightingSleepSettings initial={lastSent.sleepTime} />
        </div>
      )}
      {editingMode === "per-key" && customEditor.controls}
    </section>
  );
}

/** The lighting sleep timer. It is sent on its own, separately from the effect. */
function LightingSleepSettings({ initial }: { initial: SleepTime | undefined }) {
  const { connected, activeOperation, runOperation } = useDeviceSession();
  const [sleepTime, setSleepTime] = useState<SleepTime>(initial ?? LightingSleepTime.Never);
  const [sentSleepTime, setSentSleepTime] = useState<SleepTime | null>(initial ?? null);
  const [sleepStatus, setSleepStatus] = useState<string | null>(null);
  const busy = activeOperation !== null;

  const applySleep = async () => {
    setSleepStatus("Applying sleep timeout…");
    try {
      await runOperation("lighting sleep", (operationController) =>
        setLightingSleepTime(operationController, sleepTime),
      );
      setSentSleepTime(sleepTime);
      rememberSentLighting({ sleepTime });
      setSleepStatus("Sleep timeout applied");
    } catch (error) {
      setSleepStatus(errorMessage(error, "Sleep timeout update failed"));
    }
  };

  return (
    <div className="subsection sleep-section">
      <div className="sleep-section-heading">
        <p className="eyebrow">Power saving</p>
        <h3>Lighting sleep</h3>
      </div>
      <label>
        Turn lighting off after
        <select
          aria-label="Lighting sleep timeout"
          value={sleepTime}
          disabled={busy}
          onChange={(event) => {
            setSleepTime(Number(event.currentTarget.value) as SleepTime);
            setSleepStatus(null);
          }}
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
      {sentSleepTime !== null && sentSleepTime !== sleepTime && (
        <p className="lighting-feedback">Not sent yet.</p>
      )}
      {sleepStatus && (
        <p className="lighting-feedback" role="status" aria-live="polite">
          {sleepStatus}
        </p>
      )}
    </div>
  );
}

function ColorControl({ color, onChange }: { color: string; onChange(hex: string): void }) {
  return (
    <fieldset className="control-color">
      <legend>Color</legend>
      <div className="color-picker-control">
        <input
          className="lighting-color-input"
          aria-label="Lighting color"
          type="color"
          value={color}
          onInput={(event) => onChange(event.currentTarget.value)}
        />
        <span>
          <strong>{color.toUpperCase()}</strong>
          <small>Custom color</small>
        </span>
      </div>
      <fieldset className="color-presets">
        <legend className="visually-hidden">Color presets</legend>
        {COLOR_PRESETS.map(([name, preset]) => (
          <button
            type="button"
            className={classNames(color === preset && "is-active")}
            style={{ "--swatch-color": preset } as CSSProperties}
            aria-label={`Use ${name}`}
            aria-pressed={color === preset}
            onClick={() => onChange(preset)}
            key={preset}
          />
        ))}
      </fieldset>
    </fieldset>
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
  selected: LightingEffect;
  onChange(mode: LightingMode): void;
}) {
  const picker = useRef<HTMLDetailsElement>(null);

  return (
    <fieldset className="control-effect">
      <legend>Effect</legend>
      <details className="effect-picker" ref={picker}>
        <summary aria-label="Lighting effect">
          <EffectGlyph animationId={selected.animationId} />
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
              className={classNames(
                "effect-option",
                effect.protocolId === selected.protocolId && "is-active",
              )}
              aria-pressed={effect.protocolId === selected.protocolId}
              onClick={() => {
                onChange(effect.protocolId);
                if (picker.current) picker.current.open = false;
              }}
              key={effect.protocolId}
            >
              <EffectGlyph animationId={effect.animationId} />
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

function EffectGlyph({ animationId }: { animationId: LightingEffect["animationId"] }) {
  return <span className={`effect-glyph is-${animationId}`} aria-hidden="true" />;
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
        onInput={(event) => onChange(Number(event.currentTarget.value) as LightingLevel)}
      />
    </label>
  );
}
