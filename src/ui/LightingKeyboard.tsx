import type { CSSProperties, TargetedKeyboardEvent } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { rgbToHex } from "../lighting/color";
import { effectForMode, previewCycleSeconds } from "../lighting/effects";
import {
  AK820_KEY_ROWS,
  AK820_LIGHTING_KEYS,
  type ArrowKey,
  keyCentre,
  type LightingKey,
  neighbouringKeyId,
} from "../lighting/keyboard-layout";
import {
  type LightingConfig,
  LightingDirection,
  LightingMode,
  type RGBColor,
} from "../protocol/lighting";
import { classNames } from "./text";

type EffectKeyboardProps = {
  mode: "effect";
  config: LightingConfig;
};

type PerKeyKeyboardProps = {
  mode: "per-key";
  colors: readonly RGBColor[];
  onKey: (keyId: number) => void;
  onPaintKey: (keyId: number) => void;
};

export type LightingKeyboardProps = EffectKeyboardProps | PerKeyKeyboardProps;

type LitKey = LightingKey & { id: number };
type Point = { x: number; y: number };

const ARROW_KEYS: readonly string[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
/** Centre of the main key area, in key units. Radial effects animate outward from here. */
const KEYBOARD_CENTRE: Point = { x: 8.25, y: 2.5 };
/** Rail keys above this row sit above the screen; the rest sit below it. */
const SCREEN_ROW = 4;
/** Colour the per-key editor shows before effect settings exist. */
const DEFAULT_PREVIEW_COLOR = "#ff0000";

/** Shorter keycap legends for keys whose full name is only for screen readers. */
const KEYCAP_LEGENDS: Record<string, string> = {
  Left: "←",
  Right: "→",
  Up: "↑",
  Down: "↓",
  "Alt Gr": "Alt",
  "Right Ctrl": "Ctrl",
  "Right Shift": "Shift",
};

/**
 * One persistent keyboard canvas. Effects and per-key editing alter the same
 * frame, rows, and key elements instead of swapping separate render trees.
 *
 * The preview animations are CSS. Each key gets custom properties describing
 * its position (`--key-x`, `--key-distance`, …), and each effect's stylesheet
 * turns those into a delay or colour.
 */
export function LightingKeyboard(props: LightingKeyboardProps) {
  const perKey = props.mode === "per-key";
  const config = props.mode === "effect" ? props.config : null;
  const effect = config ? effectForMode(config.mode) : null;
  // Where the last click landed, for effects that react to key presses.
  const [pressedAt, setPressedAt] = useState<Point | null>(null);
  const [focusedId, setFocusedId] = useState(AK820_LIGHTING_KEYS[0].id);
  const buttonRefs = useRef(new Map<number, HTMLButtonElement>());

  const color = config ? rgbToHex(config.color) : DEFAULT_PREVIEW_COLOR;
  const cycleSeconds = previewCycleSeconds(config?.speed);
  // The multicolour effects have no accent colour to show on the yellow keys.
  const accentKeysDimmed = effect?.animationId === "bloom" || effect?.animationId === "spectrum";
  const reversed =
    config?.direction === LightingDirection.Right || config?.direction === LightingDirection.Down;

  const frameClass = perKey
    ? "is-per-key"
    : classNames(
        `is-${(effect ?? effectForMode(LightingMode.Static)).animationId}`,
        config?.rainbow && "is-rainbow",
        reversed && "is-reversed",
        pressedAt && "has-preview-trigger",
      );
  const frameStyle = {
    "--key-light": color,
    "--key-brightness": config?.mode === LightingMode.Off ? 0 : (config?.brightness ?? 5) / 5,
    "--effect-speed": `${cycleSeconds}s`,
  } as CSSProperties;
  const label = perKey
    ? "Interactive AK820 Pro per-key lighting editor"
    : `Virtual AK820 Pro lighting preview, ${effect?.displayName ?? "Static"} effect, ${color}, approximate animation`;

  // A reactive effect's ripple plays once, then the preview returns to idle.
  useEffect(() => {
    if (!pressedAt) return;
    const timer = setTimeout(() => setPressedAt(null), (cycleSeconds + 1) * 1000);
    return () => clearTimeout(timer);
  }, [cycleSeconds, pressedAt]);

  const onKeyDown = (event: TargetedKeyboardEvent<HTMLButtonElement>, keyId: number) => {
    if (!perKey || !ARROW_KEYS.includes(event.key)) return;
    event.preventDefault();
    const nextId = neighbouringKeyId(keyId, event.key as ArrowKey);
    if (nextId === undefined) return;
    setFocusedId(nextId);
    buttonRefs.current.get(nextId)?.focus();
  };

  /** One key button. `columnIndex` is set for keys laid out in the main rows. */
  const renderKey = (key: LitKey, position: Point, columnIndex?: number) => {
    const { id } = key;
    const inMainRows = columnIndex !== undefined;
    const isPressOrigin = !perKey && pressedAt?.x === position.x && pressedAt.y === position.y;
    const style = {
      ...(inMainRows && { flexGrow: key.width ?? 1, "--key-index": columnIndex }),
      "--custom-key-color": perKey ? rgbToHex(props.colors[id]) : color,
      "--key-x": position.x,
      "--key-y": position.y,
      "--key-distance": Math.hypot(position.x - KEYBOARD_CENTRE.x, position.y - KEYBOARD_CENTRE.y),
      "--key-angle": Math.atan2(position.y - KEYBOARD_CENTRE.y, position.x - KEYBOARD_CENTRE.x),
      // A stable pseudo-random 0–1 value, so twinkling keys don't all flash together.
      "--key-seed": ((id * 37) % 101) / 100,
      "--trigger-distance": pressedAt
        ? Math.hypot(position.x - pressedAt.x, position.y - pressedAt.y)
        : 0,
      "--trigger-x-distance": pressedAt ? Math.abs(position.x - pressedAt.x) : 0,
    } as CSSProperties;

    return (
      <button
        type="button"
        className={classNames(
          "keyboard-key",
          `is-${key.group}`,
          key.accent && "is-accent-key",
          key.accent && accentKeysDimmed && "is-light-blocked",
          isPressOrigin && "is-preview-origin",
        )}
        style={style}
        // In effect mode the keyboard is a picture; only the per-key editor is interactive.
        aria-hidden={perKey ? undefined : true}
        aria-label={perKey ? key.label : undefined}
        tabIndex={perKey && focusedId === id ? 0 : -1}
        ref={(element) => {
          if (element) buttonRefs.current.set(id, element);
          else buttonRefs.current.delete(id);
        }}
        onFocus={() => perKey && setFocusedId(id)}
        onKeyDown={(event) => onKeyDown(event, id)}
        onClick={() => perKey && props.onKey(id)}
        onPointerDown={() => !perKey && effect?.reactive && setPressedAt(position)}
        onPointerEnter={(event) => perKey && event.buttons === 1 && props.onPaintKey(id)}
        key={id}
      >
        {KEYCAP_LEGENDS[key.label] ?? key.label}
      </button>
    );
  };

  const railKeys = AK820_LIGHTING_KEYS.filter((key) => key.rail);
  const renderRail = (aboveScreen: boolean) =>
    railKeys
      .filter((key) => (key.rail?.y ?? 0) < SCREEN_ROW === aboveScreen)
      .map((key) => renderKey(key, key.rail as Point));

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
                .filter((key) => !key.rail)
                .map((key, columnIndex) =>
                  key.id === undefined ? (
                    <span
                      className="keyboard-spacer"
                      style={{ flexGrow: key.width ?? 1 }}
                      aria-hidden="true"
                      key={key.label}
                    />
                  ) : (
                    renderKey(key as LitKey, keyCentre(rowIndex, row.indexOf(key)), columnIndex)
                  ),
                )}
            </div>
          ))}
        </div>
        <div className="keyboard-side">
          <span className="keyboard-knob" aria-hidden="true" />
          {renderRail(true)}
          <span className="keyboard-status-lights" aria-hidden="true">
            <i>C</i>
            <i>W</i>
          </span>
          <span className="keyboard-screen" aria-hidden="true">
            <i>12/9</i>
            <b>01:38:51</b>
          </span>
          {renderRail(false)}
        </div>
      </div>
    </figure>
  );
}
