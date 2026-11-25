import { useCallback, useState } from "preact/hooks";
import { useDeviceSession } from "../device/DeviceSession";
import { DEFAULT_LIGHTING_CONFIG } from "../lighting/default-config";
import { configForEffect, effectForMode } from "../lighting/effects";
import { rememberSentLighting } from "../lighting/storage";
import { setLighting } from "../operations";
import type { LightingConfig, LightingMode } from "../protocol/lighting";
import { EffectValidation } from "./EffectValidation";
import { errorMessage } from "./text";

export function EffectTestingPanel() {
  const { connected, activeOperation, runOperation } = useDeviceSession();
  const [config, setConfig] = useState(DEFAULT_LIGHTING_CONFIG);
  const [status, setStatus] = useState<string | null>(null);
  // Nothing is written until the tester asks; this tracks which effect is on
  // the keyboard so results can only be recorded for what was actually shown.
  const [appliedMode, setAppliedMode] = useState<LightingMode | null>(null);
  const busy = activeOperation !== null;

  const selectAndApply = useCallback(
    async (mode: LightingMode) => {
      const nextEffect = effectForMode(mode);
      const nextConfig: LightingConfig = configForEffect({ ...config, mode });
      setConfig(nextConfig);
      setStatus(`Applying ${nextEffect.displayName}…`);
      try {
        await runOperation("lighting", (operationController) =>
          setLighting(operationController, nextConfig),
        );
        setAppliedMode(mode);
        rememberSentLighting({ config: nextConfig });
        setStatus(`${nextEffect.displayName} applied · protocol effect ${mode}`);
      } catch (error) {
        setAppliedMode(null);
        setStatus(errorMessage(error, "Lighting update failed"));
      }
    },
    [config, runOperation],
  );

  return (
    <section className="panel testing-panel testing-workspace">
      <EffectValidation
        mode={config.mode}
        canApply={connected && !busy}
        applied={appliedMode === config.mode}
        onSelectAndApply={selectAndApply}
        applyStatus={status}
      />
    </section>
  );
}
