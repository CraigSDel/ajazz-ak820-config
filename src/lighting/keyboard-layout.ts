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

/** LED IDs arranged as the ANSI AK820 Pro shown in the supplied product image. */
export const AK820_KEY_ROWS: readonly (readonly LightingKey[])[] = [
  [
    key(0, "Esc", "function"),
    gap("esc", 0.35),
    ...Array.from({ length: 4 }, (_, index) => key(index + 1, `F${index + 1}`, "function")),
    gap("f4", 0.25),
    ...Array.from({ length: 4 }, (_, index) => key(index + 5, `F${index + 5}`, "function")),
    gap("f8", 0.25),
    ...Array.from({ length: 4 }, (_, index) => key(index + 9, `F${index + 9}`, "function")),
    gap("delete", 0.15),
    key(106, "Del", "navigation"),
  ],
  [
    key(16, "`", "numbers"),
    ...Array.from({ length: 10 }, (_, index) => key(index + 17, `${(index + 1) % 10}`, "numbers")),
    key(27, "-", "numbers"),
    key(28, "=", "numbers"),
    key(92, "Backspace", "numbers", 2),
    gap("end", 0.75),
    key(107, "Home", "navigation"),
  ],
  [
    key(32, "Tab", "modifiers", 1.5),
    ...["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"].map((label, index) =>
      key(index + 33, label, "letters"),
    ),
    key(43, "[", "letters"),
    key(44, "]", "letters"),
    key(76, "\\", "letters", 1.5),
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
    key(97, "Enter", "modifiers", 2.25),
    gap("pgdn", 0.75),
    key(108, "PgDn", "navigation"),
  ],
  [
    key(64, "Shift", "modifiers", 2.25),
    ...["Z", "X", "C", "V", "B", "N", "M", ",", ".", "/"].map((label, index) =>
      key(index + 65, label, "letters"),
    ),
    key(75, "Shift", "modifiers", 1.75),
    gap("up", 0.2),
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
    gap("arrows", 0.2),
    key(88, "Left", "arrows"),
    key(89, "Down", "arrows"),
    key(91, "Right", "arrows"),
  ],
] as const;

export const AK820_LIGHTING_KEYS = AK820_KEY_ROWS.flat().filter(
  (item): item is LightingKey & { ledId: number } => item.ledId !== undefined,
);
