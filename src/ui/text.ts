/** Join the class names that are switched on: `classNames("key", active && "is-active")`. */
export function classNames(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}

/** `plural(1, "frame")` → "1 frame"; `plural(3, "frame")` → "3 frames". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** The message to show for a caught error, or `fallback` when it isn't an `Error`. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
