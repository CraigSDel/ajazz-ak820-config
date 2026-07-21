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
  for (const { mode } of LIGHTING_EFFECTS) empty[mode] = { result: "untested", note: "" };
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
}: {
  mode: LightingMode;
  canApply: boolean;
  onSelectAndApply(mode: LightingMode): Promise<void>;
}) {
  const [observations, setObservations] = useState<Observations>(initialObservations);
  const selected = effectForMode(mode);
  const observation = observations[mode];
  const tested = Object.values(observations).filter(({ result }) => result !== "untested").length;
  const report = useMemo(() => buildEffectReport(observations), [observations]);
  const remaining = LIGHTING_EFFECTS.length - tested;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(observations));
  }, [observations]);

  const update = (change: Partial<Observation>) =>
    setObservations((current) => ({
      ...current,
      [mode]: { ...current[mode], ...change },
    }));

  const next = async () => {
    const start = LIGHTING_EFFECTS.findIndex((effect) => effect.mode === mode);
    const nextEffect = [
      ...LIGHTING_EFFECTS.slice(start + 1),
      ...LIGHTING_EFFECTS.slice(0, start + 1),
    ].find((effect) => effect.mode !== mode && observations[effect.mode].result === "untested");
    if (nextEffect) await onSelectAndApply(nextEffect.mode);
  };

  const recordAndContinue = async (result: Exclude<Result, "untested">) => {
    update({ result });
    if (result !== "connection-error" && canApply) await next();
  };

  return (
    <section className="effect-validation settings-card" aria-labelledby="test-runner-title">
      <div className="validation-heading">
        <div>
          <p className="eyebrow">Test runner</p>
          <h3 id="test-runner-title">What does the keyboard show?</h3>
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
        Observe <strong>{selected.name}</strong> · mode {mode}.
        {selected.reactive ? " Press several physical keys first." : ""}
      </p>
      <label className="validation-note">
        Note · required for Wrong effect
        <input
          value={observation.note}
          placeholder="What appeared instead?"
          onChange={(event) => update({ note: event.target.value })}
        />
      </label>
      <fieldset className="validation-results">
        <legend>Save result and continue</legend>
        {(["works", "wrong-effect", "no-light"] as const).map((result) => (
          <button
            type="button"
            className={observation.result === result ? `result-${result} is-active` : `result-${result}`}
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
      <div className="validation-secondary-actions">
        <button type="button" onClick={() => update({ result: "connection-error" })}>
          Connection error
        </button>
        <button
          type="button"
          disabled={!canApply || remaining === 0}
          onClick={next}
        >
          Skip for now
        </button>
      </div>
      <details className="validation-report">
        <summary>View report · saved in this browser</summary>
        <label>
          Copy this report when testing is complete
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
    const observation = observations[effect.mode];
    const note = observation.note.trim() ? ` — ${observation.note.trim()}` : "";
    lines.push(
      `- Mode ${effect.mode} / ${effect.name}: ${RESULT_LABELS[observation.result]}${note}`,
    );
  }
  return lines.join("\n");
}
