import { useEffect, useMemo, useState } from "react";
import { effectForMode, LIGHTING_EFFECTS } from "../lighting/effects";
import type { LightingMode } from "../protocol/lighting";

type Result = "untested" | "works" | "wrong-effect" | "no-light" | "connection-error";
type Observation = { result: Result; note: string };
type Observations = Record<number, Observation>;

// The version changes when the hardware transaction changes so old results do
// not get mixed with tests of a corrected implementation.
const STORAGE_KEY = "ak820-pro-effect-validation-v5";
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
    ].find((effect) => observations[effect.mode].result === "untested");
    if (nextEffect) await onSelectAndApply(nextEffect.mode);
  };

  return (
    <details className="effect-validation settings-card">
      <summary>
        <span>
          <strong>Manual effect validation</strong>
          <small>
            {tested} of {LIGHTING_EFFECTS.length} checked · saved in this browser
          </small>
        </span>
      </summary>
      <div className="effect-validation-body">
        <p>
          Apply <strong>{selected.name}</strong> (mode {mode}), observe the physical keyboard, then
          record what happened.{" "}
          {selected.reactive ? "Press several keys before judging this reactive effect." : ""}
          {
            " Mark Connection error only when the app reports a disconnect, timeout, or transfer failure."
          }
        </p>
        <fieldset className="validation-results">
          <legend>Physical result for {selected.name}</legend>
          {(Object.keys(RESULT_LABELS) as Result[]).map((result) => (
            <button
              type="button"
              className={observation.result === result ? "is-active" : ""}
              aria-pressed={observation.result === result}
              onClick={() => update({ result })}
              key={result}
            >
              {RESULT_LABELS[result]}
            </button>
          ))}
        </fieldset>
        <label>
          What did the keyboard display?
          <input
            value={observation.note}
            placeholder="Example: stays on Steady; only changes after pressing a key"
            onChange={(event) => update({ note: event.target.value })}
          />
        </label>
        <button
          type="button"
          disabled={!canApply || tested === LIGHTING_EFFECTS.length}
          onClick={next}
        >
          Select and apply next untested effect
        </button>
        <label>
          Paste this report into the chat when testing is complete
          <textarea className="effect-report" readOnly value={report} rows={12} />
        </label>
      </div>
    </details>
  );
}

export function buildEffectReport(observations: Observations): string {
  const lines = [
    "# Wired AJAZZ 820 Pro effect test",
    "",
    `Generated: ${new Date().toISOString()}`,
    "Connection: wired USB",
    "Transaction: AK820 Pro START, MODE_PREAMBLE, MODE_DATA, FINISH feature reports",
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
