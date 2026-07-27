import { useEffect, useMemo, useState } from "react";
import { effectForMode, LIGHTING_EFFECTS } from "../lighting/effects";
import type { LightingMode } from "../protocol/lighting";

type Result = "untested" | "works" | "wrong-effect" | "no-light" | "connection-error";
type Observation = { result: Result; note: string; reattempts: number };
type Observations = Record<number, Observation>;

// The version changes when the hardware transaction changes so old results do
// not get mixed with tests of a corrected implementation.
const STORAGE_KEY = "ak820-pro-effect-validation-v8";
const MAX_NOTE_LENGTH = 500;
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
    empty[protocolId] = { result: "untested", note: "", reattempts: 0 };
  }
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return empty;
    for (const { protocolId } of LIGHTING_EFFECTS) {
      const candidate = (stored as Record<string, unknown>)[protocolId];
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
      const { result, note, reattempts } = candidate as Record<string, unknown>;
      if (typeof result !== "string" || !(result in RESULT_LABELS) || typeof note !== "string") {
        continue;
      }
      empty[protocolId] = {
        result: result as Result,
        note: note.slice(0, MAX_NOTE_LENGTH),
        reattempts:
          typeof reattempts === "number" && Number.isSafeInteger(reattempts) && reattempts >= 0
            ? reattempts
            : 0,
      };
    }
    return empty;
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
  const [reportGeneratedAt, setReportGeneratedAt] = useState(() => new Date().toISOString());
  const selected = effectForMode(mode);
  const observation = observations[mode];
  const tested = Object.values(observations).filter(({ result }) => result !== "untested").length;
  const report = useMemo(
    () => buildEffectReport(observations, reportGeneratedAt),
    [observations, reportGeneratedAt],
  );
  const remaining = LIGHTING_EFFECTS.length - tested;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(observations));
  }, [observations]);

  const update = (change: Partial<Observation>) => {
    setCopyStatus(null);
    setReportGeneratedAt(new Date().toISOString());
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
    const generatedAt = new Date().toISOString();
    const nextObservations = {
      ...observations,
      [mode]: { ...observations[mode], result },
    };
    setCopyStatus(null);
    setReportGeneratedAt(generatedAt);
    setObservations(nextObservations);
    if (canApply) await next();
  };

  const reattempt = async () => {
    setCopyStatus(null);
    setReportGeneratedAt(new Date().toISOString());
    setObservations((current) => ({
      ...current,
      [mode]: {
        ...current[mode],
        reattempts: current[mode].reattempts + 1,
      },
    }));
    await onSelectAndApply(mode);
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopyStatus("Report copied to clipboard.");
    } catch {
      setCopyStatus("Clipboard unavailable. Select and copy the report below.");
    }
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
      <button type="button" disabled={!canApply} onClick={reattempt}>
        Reattempt RGB
      </button>
      {applyStatus && (
        <p className="lighting-feedback" role="status" aria-live="polite">
          {applyStatus}
        </p>
      )}
      <label className="validation-note">
        Note · required for Wrong effect
        <input
          value={observation.note}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="What appeared instead?"
          onChange={(event) => update({ note: event.target.value })}
        />
      </label>
      <fieldset className="validation-results">
        <legend>Save result and continue</legend>
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
        <div className="validation-report-actions">
          <button type="button" onClick={copyReport} aria-label="Copy report to clipboard">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 5.5h8.5A1.5 1.5 0 0 1 19 7v11.5a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 9 5.5Z" />
              <path d="M15.5 5.5V4A1.5 1.5 0 0 0 14 2.5H5.5A1.5 1.5 0 0 0 4 4v11.5A1.5 1.5 0 0 0 5.5 17h2" />
            </svg>
            Copy report
          </button>
        </div>
        <label>
          Current test report
          <textarea className="effect-report" readOnly value={report} rows={12} />
        </label>
      </details>
    </section>
  );
}

export function buildEffectReport(
  observations: Observations,
  generatedAt = new Date().toISOString(),
): string {
  const lines = [
    "# Wired AJAZZ 820 Pro effect test",
    "",
    `Generated: ${generatedAt}`,
    "Connection: wired USB",
    "Transaction: AK820 Pro START, MODE_PREAMBLE, MODE_DATA, FINISH feature reports ×2; mode-scoped MODE_DATA handshake",
    "",
  ];
  for (const effect of LIGHTING_EFFECTS) {
    const observation = observations[effect.protocolId];
    const details: string[] = [];
    if (observation.note.trim()) details.push(observation.note.trim());
    if (observation.reattempts > 0) {
      details.push(
        `RGB reapplied ${observation.reattempts} ${observation.reattempts === 1 ? "time" : "times"}`,
      );
    }
    const suffix = details.length > 0 ? ` — ${details.join("; ")}` : "";
    lines.push(
      `- Protocol effect ${effect.protocolId} / ${effect.displayName}: ${RESULT_LABELS[observation.result]}${suffix}`,
    );
  }
  return lines.join("\n");
}
