import { type CSSProperties, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { effectForMode } from "../lighting/effects";
import { AK820_KEY_ROWS, type LightingKey } from "../lighting/keyboard-layout";
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

const RAIL_KEY_IDS = new Set([91, 105, 107, 108]);
const ACCENT_KEY_IDS = new Set([0, 83, 97]);
const SIDE_KEY_GEOMETRY = new Map([
  [107, { x: 16.85, y: 1 }],
  [105, { x: 16.85, y: 2 }],
  [108, { x: 16.85, y: 3 }],
  [91, { x: 16.85, y: 5 }],
]);

export type PreviewKeyGeometry = { x: number; y: number; centerDistance: number };

export function previewKeyGeometry(
  row: readonly LightingKey[],
  rowIndex: number,
  itemIndex: number,
): PreviewKeyGeometry {
  const item = row[itemIndex];
  const x =
    row.slice(0, itemIndex).reduce((sum, key) => sum + (key.width ?? 1), 0) + (item.width ?? 1) / 2;
  const y = rowIndex;
  return { x, y, centerDistance: Math.hypot(x - 8.25, y - 2.5) };
}

function visibleKeyLabel(label: string): string {
  return (
    {
      Left: "←",
      Right: "→",
      Up: "↑",
      Down: "↓",
      "Alt Gr": "Alt",
      "R Ctrl": "Ctrl",
    }[label] ?? label
  );
}

/**
 * One persistent keyboard canvas. Effects and per-key editing alter the same
 * frame, rows, and key elements instead of swapping separate render trees.
 */
export function LightingKeyboard(props: LightingKeyboardProps) {
  const perKey = props.mode === "per-key";
  const config = props.mode === "effect" ? props.config : null;
  const effect = config ? effectForMode(config.mode) : null;
  const blocksAccentLighting =
    effect?.animation.id === "bloom" || effect?.animation.id === "spectrum";
  const [trigger, setTrigger] = useState<{ row: number; column: number } | null>(null);
  const [focusedId, setFocusedId] = useState(0);
  const buttonRefs = useRef(new Map<number, HTMLButtonElement>());
  const color = config ? rgbToHex(config.color) : "#ff0000";
  const reverse =
    config?.direction === LightingDirection.Right || config?.direction === LightingDirection.Down;
  const frameClass = perKey
    ? "is-per-key"
    : `${previewEffectClass(config?.mode ?? LightingMode.Effect1)}${config?.rainbow ? " is-rainbow" : ""}${reverse ? " is-reversed" : ""}${trigger ? " has-preview-trigger" : ""}`;
  const frameStyle = {
    "--key-light": color,
    "--key-brightness": config?.mode === LightingMode.Off ? 0 : (config?.brightness ?? 5) / 5,
    "--effect-speed": `${effect?.animation.speedSeconds[(config?.speed ?? 3) - 1] ?? 1.6}s`,
  } as CSSProperties;
  const label = perKey
    ? "Interactive AK820 Pro per-key lighting editor"
    : `Virtual AK820 Pro lighting preview, ${effect?.displayName ?? "Static"} effect, ${color}, ${effect?.animation.calibrated ? "hardware calibrated" : "provisional simulation"}`;

  useEffect(() => {
    if (!trigger) return;
    const cycleSeconds = effect?.animation.speedSeconds[(config?.speed ?? 3) - 1] ?? 1.6;
    const timer = setTimeout(() => setTrigger(null), (cycleSeconds + 1) * 1000);
    return () => clearTimeout(timer);
  }, [config?.speed, effect?.animation.speedSeconds, trigger]);

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
      <div className="keyboard-deck">
        <div className="keyboard-keys">
          {AK820_KEY_ROWS.map((row, rowIndex) => (
            <div className="keyboard-row" key={`keyboard-row-${row[0].label}`}>
              {row
                .filter((item) => !RAIL_KEY_IDS.has(item.ledId ?? -1))
                .map((item, columnIndex) => {
                  const originalIndex = row.indexOf(item);
                  const geometry = previewKeyGeometry(row, rowIndex, originalIndex);
                  return item.ledId === undefined ? (
                    <span
                      className="keyboard-spacer"
                      style={{ flexGrow: item.width ?? 1 }}
                      aria-hidden="true"
                      key={item.ledId ?? item.label}
                    />
                  ) : (
                    <button
                      type="button"
                      className={`keyboard-key is-${item.group}${ACCENT_KEY_IDS.has(item.ledId) ? ` is-accent-key${blocksAccentLighting ? " is-light-blocked" : ""}` : ""}${!perKey && trigger?.row === geometry.y && trigger.column === geometry.x ? " is-preview-origin" : ""}`}
                      style={
                        {
                          flexGrow: item.width ?? 1,
                          "--custom-key-color": perKey ? rgbToHex(props.colors[item.ledId]) : color,
                          "--key-index": columnIndex,
                          "--key-x": geometry.x,
                          "--key-y": geometry.y,
                          "--key-distance": geometry.centerDistance,
                          "--key-angle": Math.atan2(geometry.y - 2.5, geometry.x - 8.25),
                          "--key-seed": ((item.ledId * 37) % 101) / 100,
                          "--trigger-distance": trigger
                            ? Math.hypot(geometry.x - trigger.column, geometry.y - trigger.row)
                            : 0,
                          "--trigger-x-distance": trigger
                            ? Math.abs(geometry.x - trigger.column)
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
                        setTrigger({ row: geometry.y, column: geometry.x })
                      }
                      onPointerEnter={(event) =>
                        perKey && event.buttons === 1 && props.onPaintKey(item.ledId as number)
                      }
                      key={item.ledId}
                    >
                      {visibleKeyLabel(item.label)}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
        <div className="keyboard-side">
          <span className="keyboard-knob" aria-hidden="true" />
          {[107, 105, 108].map((ledId) => {
            const item = AK820_KEY_ROWS.flat().find((keyItem) => keyItem.ledId === ledId);
            if (!item) return null;
            const geometry = SIDE_KEY_GEOMETRY.get(ledId) as { x: number; y: number };
            return (
              <button
                type="button"
                className={`keyboard-key is-navigation${!perKey && trigger?.row === geometry.y && trigger.column === geometry.x ? " is-preview-origin" : ""}`}
                style={
                  {
                    "--custom-key-color": perKey ? rgbToHex(props.colors[ledId]) : color,
                    "--key-x": geometry.x,
                    "--key-y": geometry.y,
                    "--key-distance": Math.hypot(geometry.x - 8.25, geometry.y - 2.5),
                    "--key-angle": Math.atan2(geometry.y - 2.5, geometry.x - 8.25),
                    "--key-seed": ((ledId * 37) % 101) / 100,
                    "--trigger-distance": trigger
                      ? Math.hypot(geometry.x - trigger.column, geometry.y - trigger.row)
                      : 0,
                    "--trigger-x-distance": trigger ? Math.abs(geometry.x - trigger.column) : 0,
                  } as CSSProperties
                }
                aria-hidden={perKey ? undefined : true}
                aria-label={perKey ? `${item.label}, LED ${ledId}` : undefined}
                tabIndex={perKey && focusedId === ledId ? 0 : -1}
                ref={(element) => {
                  if (element) buttonRefs.current.set(ledId, element);
                  else buttonRefs.current.delete(ledId);
                }}
                onFocus={() => perKey && setFocusedId(ledId)}
                onKeyDown={(event) => onKeyDown(event, ledId)}
                onClick={() => perKey && props.onKey(ledId)}
                onPointerDown={() =>
                  !perKey && effect?.reactive && setTrigger({ row: geometry.y, column: geometry.x })
                }
                onPointerEnter={(event) => perKey && event.buttons === 1 && props.onPaintKey(ledId)}
                key={ledId}
              >
                {item.label}
              </button>
            );
          })}
          <span className="keyboard-status-lights" aria-hidden="true">
            <i>C</i>
            <i>W</i>
          </span>
          <span className="keyboard-screen" aria-hidden="true">
            <i>12/9</i>
            <b>01:38:51</b>
          </span>
          <button
            type="button"
            className={`keyboard-key is-arrows${!perKey && trigger?.row === 5 && trigger.column === 16.85 ? " is-preview-origin" : ""}`}
            style={
              {
                "--custom-key-color": perKey ? rgbToHex(props.colors[91]) : color,
                "--key-x": SIDE_KEY_GEOMETRY.get(91)?.x,
                "--key-y": SIDE_KEY_GEOMETRY.get(91)?.y,
                "--key-distance": Math.hypot(16.85 - 8.25, 5 - 2.5),
                "--key-angle": Math.atan2(5 - 2.5, 16.85 - 8.25),
                "--key-seed": ((91 * 37) % 101) / 100,
                "--trigger-distance": trigger
                  ? Math.hypot(16.85 - trigger.column, 5 - trigger.row)
                  : 0,
                "--trigger-x-distance": trigger ? Math.abs(16.85 - trigger.column) : 0,
              } as CSSProperties
            }
            aria-hidden={perKey ? undefined : true}
            aria-label={perKey ? "Right, LED 91" : undefined}
            tabIndex={perKey && focusedId === 91 ? 0 : -1}
            ref={(element) => {
              if (element) buttonRefs.current.set(91, element);
              else buttonRefs.current.delete(91);
            }}
            onFocus={() => perKey && setFocusedId(91)}
            onKeyDown={(event) => onKeyDown(event, 91)}
            onClick={() => perKey && props.onKey(91)}
            onPointerDown={() =>
              !perKey && effect?.reactive && setTrigger({ row: 5, column: 16.85 })
            }
            onPointerEnter={(event) => perKey && event.buttons === 1 && props.onPaintKey(91)}
          >
            →
          </button>
        </div>
      </div>
    </figure>
  );
}

function previewEffectClass(mode: LightingMode): string {
  return `is-${effectForMode(mode).animation.id}`;
}
