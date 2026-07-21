export type LightingKey = {
  ledId?: number;
  label: string;
  width?: number;
  group?: "function" | "numbers" | "letters" | "modifiers" | "navigation" | "arrows";
};

const key = (
  ledId: number,
  label: string,
  group: LightingKey["group"],
  width = 1,
): LightingKey => ({
  ledId,
  label,
  group,
  width,
});
const gap = (label: string, width: number): LightingKey => ({ label: `gap-${label}`, width });

/** LED IDs and ISO positions from the official AK820/820PRO configuration. */
export const AK820_KEY_ROWS: readonly (readonly LightingKey[])[] = [
  [
    key(0, "Esc", "function"),
    gap("esc", 0.75),
    ...Array.from({ length: 12 }, (_, index) => key(index + 1, `F${index + 1}`, "function")),
    gap("delete", 1),
    key(106, "Del", "navigation"),
  ],
  [
    key(16, "`", "numbers"),
    ...Array.from({ length: 10 }, (_, index) => key(index + 17, `${(index + 1) % 10}`, "numbers")),
    key(27, "-", "numbers"),
    key(28, "=", "numbers"),
    key(92, "Back", "numbers", 2),
    gap("end", 0.75),
    key(107, "End", "navigation"),
  ],
  [
    key(32, "Tab", "modifiers", 1.5),
    ...["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"].map((label, index) =>
      key(index + 33, label, "letters"),
    ),
    key(43, "[", "letters"),
    key(44, "]", "letters"),
    key(76, "Enter", "modifiers", 1.5),
    gap("pgup", 0.75),
    key(105, "PgUp", "navigation"),
  ],
  [
    key(48, "Caps", "modifiers", 1.75),
    ...["A", "S", "D", "F", "G", "H", "J", "K", "L"].map((label, index) =>
      key(index + 49, label, "letters"),
    ),
    key(58, ";", "letters"),
    key(59, "'", "letters"),
    key(97, "#", "letters", 1.25),
    gap("pgdn", 0.75),
    key(108, "PgDn", "navigation"),
  ],
  [
    key(64, "Shift", "modifiers", 2.25),
    key(98, "ISO", "letters"),
    ...["Z", "X", "C", "V", "B", "N", "M", ",", ".", "/"].map((label, index) =>
      key(index + 65, label, "letters"),
    ),
    key(75, "Shift", "modifiers", 1.75),
    gap("up", 0.75),
    key(90, "Up", "arrows"),
  ],
  [
    key(80, "Ctrl", "modifiers", 1.25),
    key(81, "Win", "modifiers", 1.25),
    key(82, "Alt", "modifiers", 1.25),
    key(83, "Space", "modifiers", 6.25),
    key(84, "Alt Gr", "modifiers", 1.25),
    key(85, "Fn", "modifiers", 1.25),
    key(87, "R Ctrl", "modifiers", 1.25),
    key(88, "Left", "arrows"),
    key(89, "Down", "arrows"),
    key(91, "Right", "arrows"),
  ],
] as const;

export const AK820_LIGHTING_KEYS = AK820_KEY_ROWS.flat().filter(
  (item): item is LightingKey & { ledId: number } => item.ledId !== undefined,
);
