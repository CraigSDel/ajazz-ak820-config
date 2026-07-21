import { useEffect, useMemo, useState } from "react";
import { effectForMode, LIGHTING_EFFECTS } from "../lighting/effects";
import type { LightingMode } from "../protocol/lighting";

type Result = "untested" | "works" | "wrong-effect" | "no-light" | "connection-error";
type Observation = { result: Result; note: string };
type Observations = Record<number, Observation>;

// The version changes when the hardware transaction changes so old results do
// not get mixed with tests of a corrected implementation.
const STORAGE_KEY = "ak820-pro-effect-validation-v7";
const RESULT_LABELS: Record<Result, string> = {
  untested: "Untested",
  works: "Works",
  "wrong-effect": "Wrong effect",
  "no-light": "No lighting",
  "connection-error": "Connection error",
};

function initialObservations(): Observations {
  const empty: Observations = {};
  for (const { protocolId } of LIGHTING_EFFECTS) {
    empty[protocolId] = { result: "untested", note: "" };
  }
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") };
  } catch {
    return empty;
  }
}

export function EffectValidation({
  mode,
  canApply,
  onSelectAndApply,
  applyStatus,
}: {
  mode: LightingMode;
  canApply: boolean;
  onSelectAndApply(mode: LightingMode): Promise<void>;
  applyStatus: string | null;
}) {
  const [observations, setObservations] = useState<Observations>(initialObservations);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const selected = effectForMode(mode);
  const observation = observations[mode];
  const tested = Object.values(observations).filter(({ result }) => result !== "untested").length;
  const report = useMemo(() => buildEffectReport(observations), [observations]);
  const remaining = LIGHTING_EFFECTS.length - tested;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(observations));
  }, [observations]);

  const update = (change: Partial<Observation>) => {
    setCopyStatus(null);
    setObservations((current) => ({
      ...current,
      [mode]: { ...current[mode], ...change },
    }));
  };

  const next = async () => {
    const start = LIGHTING_EFFECTS.findIndex((effect) => effect.protocolId === mode);
    const nextEffect = [
      ...LIGHTING_EFFECTS.slice(start + 1),
      ...LIGHTING_EFFECTS.slice(0, start + 1),
    ].find(
      (effect) =>
        effect.protocolId !== mode && observations[effect.protocolId].result === "untested",
    );
    if (nextEffect) await onSelectAndApply(nextEffect.protocolId);
  };

  const recordAndContinue = async (result: Exclude<Result, "untested">) => {
    const nextObservations = {
      ...observations,
      [mode]: { ...observations[mode], result },
    };
    setObservations(nextObservations);
    try {
      await navigator.clipboard.writeText(buildEffectReport(nextObservations));
      setCopyStatus("Result saved and report copied to clipboard.");
    } catch {
      setCopyStatus("Result saved. Clipboard unavailable; copy the report below.");
    }
    if (canApply) await next();
  };

  return (
    <section className="effect-validation settings-card" aria-labelledby="test-runner-title">
      <div className="validation-heading">
        <div>
          <p className="eyebrow">Test runner</p>
          <h3 id="test-runner-title">{selected.displayName}</h3>
        </div>
        <strong className="validation-count">
          {tested}/{LIGHTING_EFFECTS.length}
        </strong>
      </div>
      <div
        className="validation-progress"
        role="progressbar"
        aria-label="Effect test progress"
        aria-valuemin={0}
        aria-valuemax={LIGHTING_EFFECTS.length}
        aria-valuenow={tested}
      >
        <span style={{ width: `${(tested / LIGHTING_EFFECTS.length) * 100}%` }} />
      </div>
      <p className="validation-instruction">
        Mode {mode} · observe the keyboard, then record what it shows.
      </p>
      {applyStatus && (
        <p className="lighting-feedback" role="status" aria-live="polite">
          {applyStatus}
        </p>
      )}
      <label className="validation-note">
        Note · required for Wrong effect
        <input
          value={observation.note}
          placeholder="What appeared instead?"
          onChange={(event) => update({ note: event.target.value })}
        />
      </label>
      <fieldset className="validation-results">
        <legend>Save, copy report and continue</legend>
        {(["works", "wrong-effect", "no-light"] as const).map((result) => (
          <button
            type="button"
            className={
              observation.result === result ? `result-${result} is-active` : `result-${result}`
            }
            aria-pressed={observation.result === result}
            disabled={!canApply || (result === "wrong-effect" && !observation.note.trim())}
            onClick={() => recordAndContinue(result)}
            key={result}
          >
            {RESULT_LABELS[result]}
            <span aria-hidden="true">→</span>
          </button>
        ))}
      </fieldset>
      {copyStatus && (
        <p className="validation-copy-status" role="status" aria-live="polite">
          {copyStatus}
        </p>
      )}
      <details className="validation-report" open={remaining === 0}>
        <summary>Report · saved in this browser</summary>
        <label>
          Report copied after every result
          <textarea className="effect-report" readOnly value={report} rows={12} />
        </label>
      </details>
    </section>
  );
}

export function buildEffectReport(observations: Observations): string {
  const lines = [
    "# Wired AJAZZ 820 Pro effect test",
    "",
    `Generated: ${new Date().toISOString()}`,
    "Connection: wired USB",
    "Transaction: AK820 Pro START, MODE_PREAMBLE, MODE_DATA, FINISH feature reports ×2",
    "",
  ];
  for (const effect of LIGHTING_EFFECTS) {
    const observation = observations[effect.protocolId];
    const note = observation.note.trim() ? ` — ${observation.note.trim()}` : "";
    lines.push(
      `- Protocol effect ${effect.protocolId} / ${effect.displayName}: ${RESULT_LABELS[observation.result]}${note}`,
    );
  }
  return lines.join("\n");
}
