import { useCallback, useEffect, useRef, useState } from "react";
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
  const busy = activeOperation !== null;
  const autoApplied = useRef(false);

  const selectAndApply = useCallback(
    async (mode: LightingMode) => {
      const nextEffect = effectForMode(mode);
      const nextConfig: LightingConfig = {
        ...config,
        mode,
        direction: nextEffect.directions[0]?.[0] ?? config.direction,
      };
      setConfig(nextConfig);
      setStatus(`Applying ${nextEffect.displayName}…`);
      try {
        await runOperation("lighting", () => setLighting(controller, nextConfig));
        setStatus(`${nextEffect.displayName} applied · protocol effect ${mode}`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Lighting update failed");
      }
    },
    [config, controller, runOperation],
  );

  useEffect(() => {
    if (!connected || autoApplied.current) return;
    autoApplied.current = true;
    void selectAndApply(config.mode);
  }, [connected, config.mode, selectAndApply]);

  return (
    <section className="panel lighting-panel">
      <EffectValidation
        mode={config.mode}
        canApply={connected && !busy}
        onSelectAndApply={selectAndApply}
        applyStatus={status}
      />
    </section>
  );
}
