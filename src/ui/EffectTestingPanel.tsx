import { useState } from "react";
import { useDeviceSession } from "../device/DeviceSession";
import { effectForMode } from "../lighting/effects";
import { DEFAULT_LIGHTING_CONFIG } from "../lighting/default-config";
import { setLighting } from "../operations";
import type { LightingConfig, LightingMode } from "../protocol/lighting";
import { EffectValidation } from "./EffectValidation";

export function EffectTestingPanel() {
  const { controller, connected, activeOperation, runOperation } = useDeviceSession();
  const [config, setConfig] = useState(DEFAULT_LIGHTING_CONFIG);
  const [status, setStatus] = useState<string | null>(null);
  const effect = effectForMode(config.mode);
  const busy = activeOperation !== null;

  const selectAndApply = async (mode: LightingMode) => {
    const nextEffect = effectForMode(mode);
    const nextConfig: LightingConfig = {
      ...config,
      mode,
      direction: nextEffect.directions[0]?.[0] ?? config.direction,
    };
    setConfig(nextConfig);
    setStatus(`Applying ${nextEffect.name}…`);
    try {
      await runOperation("lighting", () => setLighting(controller, nextConfig));
      setStatus(`${nextEffect.name} applied · mode ${mode}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Lighting update failed");
    }
  };

  return (
    <section className="panel lighting-panel">
      <div className="settings-card">
        <p className="eyebrow">Hardware validation</p>
        <h2>{effect.name}</h2>
        <p>
          Mode {config.mode} · red · brightness 5 · speed 3
          {effect.reactive ? ". Press several physical keys after applying." : "."}
        </p>
        <button
          type="button"
          className="primary-action"
          disabled={!connected || busy}
          onClick={() => selectAndApply(config.mode)}
        >
          {status ? "Apply again" : "Start test"}
        </button>
        {status && (
          <p className="lighting-feedback settings-card-feedback" role="status" aria-live="polite">
            {status}
          </p>
        )}
      </div>
      <EffectValidation
        mode={config.mode}
        canApply={connected && !busy}
        onSelectAndApply={selectAndApply}
      />
    </section>
  );
}
