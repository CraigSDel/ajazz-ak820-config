export type LightingKey = {
  /**
   * The key's ID in the AK820 Pro firmware's lighting table, as captured from
   * the OEM driver's custom-lighting transfer. It follows the key matrix
   * (row × 0x12 + column + 1). Spacers have no ID.
   */
  id?: number;
  label: string;
  width?: number;
  group?: "function" | "numbers" | "letters" | "modifiers" | "navigation" | "arrows";
  /** Yellow accent keycap in the product image. */
  accent?: boolean;
  /** Drawn in the right-hand column beside the knob, at this preview position. */
  rail?: { x: number; y: number };
};

type KeyOptions = Pick<LightingKey, "accent" | "rail">;

const key = (
  id: number,
  label: string,
  group: LightingKey["group"],
  width = 1,
  options: KeyOptions = {},
): LightingKey => ({ id, label, group, width, ...options });
const gap = (label: string, width: number): LightingKey => ({ label: `gap-${label}`, width });
/** Keys with consecutive IDs starting at `firstId`. */
const run = (firstId: number, labels: readonly string[], group: LightingKey["group"]) =>
  labels.map((label, index) => key(firstId + index, label, group));

const RAIL_X = 16.85;

/** The ANSI AK820 Pro as shown in the product image, with firmware key IDs. */
export const AK820_KEY_ROWS: readonly (readonly LightingKey[])[] = [
  [
    key(0x01, "Esc", "function", 1, { accent: true }),
    gap("esc", 0.35),
    ...run(0x02, ["F1", "F2", "F3", "F4"], "function"),
    gap("f4", 0.25),
    ...run(0x06, ["F5", "F6", "F7", "F8"], "function"),
    gap("f8", 0.25),
    ...run(0x0a, ["F9", "F10", "F11", "F12"], "function"),
    gap("delete", 0.15),
    key(0x77, "Del", "navigation"),
  ],
  [
    key(0x13, "`", "numbers"),
    ...run(0x14, ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"], "numbers"),
    key(0x1e, "-", "numbers"),
    key(0x1f, "=", "numbers"),
    key(0x67, "Backspace", "numbers", 2),
    gap("end", 0.75),
    key(0x75, "Home", "navigation", 1, { rail: { x: RAIL_X, y: 1 } }),
  ],
  [
    key(0x25, "Tab", "modifiers", 1.5),
    ...run(0x26, ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"], "letters"),
    key(0x30, "[", "letters"),
    key(0x31, "]", "letters"),
    key(0x43, "\\", "letters", 1.5),
    gap("pgup", 0.75),
    key(0x76, "PgUp", "navigation", 1, { rail: { x: RAIL_X, y: 2 } }),
  ],
  [
    key(0x37, "Caps", "modifiers", 1.75),
    ...run(0x38, ["A", "S", "D", "F", "G", "H", "J", "K", "L"], "letters"),
    key(0x41, ";", "letters"),
    key(0x42, "'", "letters"),
    key(0x55, "Enter", "modifiers", 2.25, { accent: true }),
    gap("pgdn", 0.75),
    key(0x79, "PgDn", "navigation", 1, { rail: { x: RAIL_X, y: 3 } }),
  ],
  [
    key(0x49, "Shift", "modifiers", 2.25),
    ...run(0x4a, ["Z", "X", "C", "V", "B", "N", "M", ",", ".", "/"], "letters"),
    key(0x54, "Right Shift", "modifiers", 1.75),
    gap("up", 0.2),
    key(0x65, "Up", "arrows"),
  ],
  [
    key(0x5b, "Ctrl", "modifiers", 1.25),
    key(0x5c, "Win", "modifiers", 1.25),
    key(0x5d, "Alt", "modifiers", 1.25),
    key(0x5e, "Space", "modifiers", 6.25, { accent: true }),
    key(0x5f, "Alt Gr", "modifiers", 1.25),
    key(0x60, "Fn", "modifiers", 1.25),
    key(0x62, "Right Ctrl", "modifiers", 1.25),
    gap("arrows", 0.2),
    key(0x63, "Left", "arrows"),
    key(0x64, "Down", "arrows"),
    key(0x66, "Right", "arrows", 1, { rail: { x: RAIL_X, y: 5 } }),
  ],
] as const;

/** Every lit key, in the order the firmware's custom-lighting table expects. */
export const AK820_LIGHTING_KEYS = AK820_KEY_ROWS.flat().filter(
  (item): item is LightingKey & { id: number } => item.id !== undefined,
);

export type ArrowKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

const keyWidth = (key: LightingKey) => key.width ?? 1;

/** Distance from the row's left edge to the key's left edge, in key units. */
function leftEdge(row: readonly LightingKey[], index: number): number {
  return row.slice(0, index).reduce((sum, key) => sum + keyWidth(key), 0);
}

/** Preview position of a key's centre, in key units from the top-left of the main rows. */
export function keyCentre(rowIndex: number, columnIndex: number): { x: number; y: number } {
  const row = AK820_KEY_ROWS[rowIndex];
  return { x: leftEdge(row, columnIndex) + keyWidth(row[columnIndex]) / 2, y: rowIndex };
}

/**
 * The key an arrow press moves focus to in the per-key editor, or undefined at
 * an edge. Left and Right step to the next lit key in the row, skipping gaps.
 * Up and Down pick the key in the next row whose centre is nearest.
 */
export function neighbouringKeyId(keyId: number, arrow: ArrowKey): number | undefined {
  const rowIndex = AK820_KEY_ROWS.findIndex((row) => row.some((key) => key.id === keyId));
  const row = AK820_KEY_ROWS[rowIndex];
  const columnIndex = row.findIndex((key) => key.id === keyId);

  if (arrow === "ArrowLeft" || arrow === "ArrowRight") {
    const step = arrow === "ArrowLeft" ? -1 : 1;
    for (let index = columnIndex + step; index >= 0 && index < row.length; index += step) {
      if (row[index].id !== undefined) return row[index].id;
    }
    return undefined;
  }

  const targetRowIndex = rowIndex + (arrow === "ArrowUp" ? -1 : 1);
  const targetRow = AK820_KEY_ROWS[targetRowIndex];
  if (!targetRow) return undefined;
  const currentX = keyCentre(rowIndex, columnIndex).x;
  let nearest: { id: number; distance: number } | undefined;
  targetRow.forEach((key, index) => {
    if (key.id === undefined) return;
    const distance = Math.abs(keyCentre(targetRowIndex, index).x - currentX);
    if (!nearest || distance < nearest.distance) nearest = { id: key.id, distance };
  });
  return nearest?.id;
}
