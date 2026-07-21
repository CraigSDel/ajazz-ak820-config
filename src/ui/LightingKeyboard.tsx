import { type CSSProperties, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { effectForMode } from "../lighting/effects";
import { AK820_KEY_ROWS } from "../lighting/keyboard-layout";
import { rgbToHex } from "../lighting/color";
import {
  type LightingConfig,
  LightingDirection,
  LightingMode,
  type RGBColor,
} from "../protocol/lighting";

type EffectKeyboardProps = {
  mode: "effect";
  config: LightingConfig;
};

type PerKeyKeyboardProps = {
  mode: "per-key";
  colors: readonly RGBColor[];
  onKey: (ledId: number) => void;
  onPaintKey: (ledId: number) => void;
};

export type LightingKeyboardProps = EffectKeyboardProps | PerKeyKeyboardProps;

/**
 * One persistent keyboard canvas. Effects and per-key editing alter the same
 * frame, rows, and key elements instead of swapping separate render trees.
 */
export function LightingKeyboard(props: LightingKeyboardProps) {
  const perKey = props.mode === "per-key";
  const config = props.mode === "effect" ? props.config : null;
  const effect = config ? effectForMode(config.mode) : null;
  const [trigger, setTrigger] = useState<{ row: number; column: number } | null>(null);
  const [focusedId, setFocusedId] = useState(0);
  const buttonRefs = useRef(new Map<number, HTMLButtonElement>());
  const color = config ? rgbToHex(config.color) : "#ff0000";
  const reverse =
    config?.direction === LightingDirection.Right || config?.direction === LightingDirection.Down;
  const frameClass = perKey
    ? "is-per-key"
    : `${previewEffectClass(config?.mode ?? LightingMode.Static)}${config?.rainbow ? " is-rainbow" : ""}${reverse ? " is-reversed" : ""}${trigger ? " has-preview-trigger" : ""}`;
  const frameStyle = {
    "--key-light": color,
    "--key-brightness": config?.mode === LightingMode.Off ? 0 : (config?.brightness ?? 5) / 5,
    "--effect-speed": `${1.8 - (config?.speed ?? 3) * 0.22}s`,
  } as CSSProperties;
  const label = perKey
    ? "Interactive AK820 Pro per-key lighting editor"
    : `Virtual AK820 Pro lighting preview, ${effect?.name ?? "Steady"} effect, ${color}`;

  useEffect(() => {
    if (!trigger) return;
    const timer = setTimeout(() => setTrigger(null), 1800);
    return () => clearTimeout(timer);
  }, [trigger]);

  const moveFocus = (ledId: number, key: string) => {
    const rowIndex = AK820_KEY_ROWS.findIndex((row) => row.some((item) => item.ledId === ledId));
    const row = AK820_KEY_ROWS[rowIndex];
    const columnIndex = row.findIndex((item) => item.ledId === ledId);
    let nextId: number | undefined;

    if (key === "ArrowLeft" || key === "ArrowRight") {
      const direction = key === "ArrowLeft" ? -1 : 1;
      for (
        let index = columnIndex + direction;
        index >= 0 && index < row.length;
        index += direction
      ) {
        if (row[index].ledId !== undefined) {
          nextId = row[index].ledId;
          break;
        }
      }
    } else {
      const targetRow = AK820_KEY_ROWS[rowIndex + (key === "ArrowUp" ? -1 : 1)];
      if (targetRow) {
        const currentCenter = row
          .slice(0, columnIndex)
          .reduce((sum, item) => sum + (item.width ?? 1), 0);
        let offset = 0;
        nextId = targetRow
          .filter((item) => item.ledId !== undefined)
          .map((item) => {
            const distance = Math.abs(offset - currentCenter);
            offset += item.width ?? 1;
            return { id: item.ledId as number, distance };
          })
          .sort((a, b) => a.distance - b.distance)[0]?.id;
      }
    }

    if (nextId === undefined) return;
    setFocusedId(nextId);
    buttonRefs.current.get(nextId)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, ledId: number) => {
    if (!perKey || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    moveFocus(ledId, event.key);
  };

  return (
    <figure
      className={`keyboard-preview ${frameClass}`}
      style={frameStyle}
      aria-label={label}
      data-keyboard-canvas="ak820"
    >
      <div className="keyboard-preview-header" aria-hidden="true">
        <span>AK820 PRO</span>
        <span className="keyboard-screen">RGB</span>
        <span className="keyboard-knob" />
      </div>
      <div className="keyboard-keys">
        {AK820_KEY_ROWS.map((row, rowIndex) => (
          <div className="keyboard-row" key={`keyboard-row-${row[0].label}`}>
            {row.map((item, columnIndex) =>
              item.ledId === undefined ? (
                <span
                  className="keyboard-spacer"
                  style={{ flexGrow: item.width ?? 1 }}
                  aria-hidden="true"
                  key={item.label}
                />
              ) : (
                <button
                  type="button"
                  className={`keyboard-key${!perKey && trigger?.row === rowIndex && trigger.column === columnIndex ? " is-preview-origin" : ""}`}
                  style={
                    {
                      flexGrow: item.width ?? 1,
                      "--custom-key-color": perKey ? rgbToHex(props.colors[item.ledId]) : color,
                      "--key-index": columnIndex,
                      "--row-index": rowIndex,
                      "--distance": Math.abs(columnIndex - 6.5) + Math.abs(rowIndex - 2.5),
                      "--trigger-distance": trigger
                        ? Math.abs(columnIndex - trigger.column) + Math.abs(rowIndex - trigger.row)
                        : 0,
                    } as CSSProperties
                  }
                  aria-hidden={perKey ? undefined : true}
                  aria-label={perKey ? `${item.label}, LED ${item.ledId}` : undefined}
                  tabIndex={perKey && focusedId === item.ledId ? 0 : -1}
                  ref={(element) => {
                    if (element) buttonRefs.current.set(item.ledId as number, element);
                    else buttonRefs.current.delete(item.ledId as number);
                  }}
                  onFocus={() => perKey && setFocusedId(item.ledId as number)}
                  onKeyDown={(event) => onKeyDown(event, item.ledId as number)}
                  onClick={() => perKey && props.onKey(item.ledId as number)}
                  onPointerDown={() =>
                    !perKey &&
                    effect?.reactive &&
                    setTrigger({ row: rowIndex, column: columnIndex })
                  }
                  onPointerEnter={(event) =>
                    perKey && event.buttons === 1 && props.onPaintKey(item.ledId as number)
                  }
                  key={item.ledId}
                >
                  {item.label}
                </button>
              ),
            )}
          </div>
        ))}
      </div>
    </figure>
  );
}

function previewEffectClass(mode: LightingMode): string {
  return `is-${effectForMode(mode).preview}`;
}
