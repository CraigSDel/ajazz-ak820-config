import { expect, test } from "vitest";
import { AK820_LIGHTING_KEYS, type ArrowKey, neighbouringKeyId } from "../keyboard-layout";

const idOf = (label: string) => {
  const key = AK820_LIGHTING_KEYS.find((item) => item.label === label);
  if (!key) throw new Error(`No key labelled ${label}`);
  return key.id;
};
const move = (from: string, arrow: ArrowKey) =>
  AK820_LIGHTING_KEYS.find((key) => key.id === neighbouringKeyId(idOf(from), arrow))?.label;

test("left and right step along the row, skipping gaps", () => {
  expect(move("Esc", "ArrowRight")).toBe("F1");
  expect(move("F5", "ArrowLeft")).toBe("F4");
  expect(move("Esc", "ArrowLeft")).toBeUndefined();
});

test("up and down move to the key whose centre is nearest", () => {
  expect(move("6", "ArrowUp")).toBe("F5");
  expect(move("Backspace", "ArrowUp")).toBe("Del");
  expect(move("Backspace", "ArrowDown")).toBe("\\");
  expect(move("Up", "ArrowUp")).toBe("Enter");
  expect(move("Space", "ArrowUp")).toBe("B");
  expect(move("Esc", "ArrowUp")).toBeUndefined();
  expect(move("Space", "ArrowDown")).toBeUndefined();
});
