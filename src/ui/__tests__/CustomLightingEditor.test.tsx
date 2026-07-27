import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
// biome-ignore lint/correctness/noUnusedImports: required by this test file's classic JSX transform
import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DeviceSessionProvider } from "../../device/DeviceSession";
import { MockDeviceController } from "../../device/mock-controller";
import { CustomLightingEditor } from "../CustomLightingEditor";

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  localStorage.clear();
});

async function renderEditor() {
  const controller = new MockDeviceController();
  await controller.connect();
  const view = render(
    <DeviceSessionProvider controller={controller}>
      <CustomLightingEditor />
    </DeviceSessionProvider>,
  );
  return { controller, ...view };
}

describe("CustomLightingEditor", () => {
  test("uses the standard feature interface without the optional command interface", async () => {
    const view = await renderEditor();
    expect(view.getByText("Wired interface ready")).toBeTruthy();
    expect(
      (view.getByRole("button", { name: "Apply custom RGB" }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(view.queryByRole("button", { name: "Read current layout" })).toBeNull();
    expect(view.queryByRole("button", { name: "Restore previous lighting" })).toBeNull();
  });

  test("paints individual keys and supports fill and clear", async () => {
    const view = await renderEditor();
    const q = view.getByRole("button", { name: "Q, LED 33" });
    fireEvent.change(view.getByLabelText("Custom paint color"), { target: { value: "#123456" } });
    fireEvent.click(q);
    expect(q.getAttribute("style")).toContain("#123456");

    fireEvent.change(view.getByLabelText("Custom paint color"), { target: { value: "#00ff00" } });
    fireEvent.click(view.getByRole("button", { name: "Fill all" }));
    expect(view.getByRole("button", { name: "W, LED 34" }).getAttribute("style")).toContain(
      "#00ff00",
    );
    fireEvent.click(view.getByRole("button", { name: "Clear all" }));
    expect(view.getByRole("button", { name: "W, LED 34" }).getAttribute("style")).toContain(
      "#000000",
    );
  });

  test("uses one tab stop and arrow-key navigation across the keyboard", async () => {
    const view = await renderEditor();
    const esc = view.getByRole("button", { name: "Esc, LED 0" });
    const f1 = view.getByRole("button", { name: "F1, LED 1" });
    expect(esc.getAttribute("tabindex")).toBe("0");
    expect(f1.getAttribute("tabindex")).toBe("-1");

    esc.focus();
    fireEvent.keyDown(esc, { key: "ArrowRight" });
    expect(document.activeElement).toBe(f1);
    expect(f1.getAttribute("tabindex")).toBe("0");
  });

  test("applies custom RGB over feature reports", async () => {
    const { controller, getByRole, queryByRole } = await renderEditor();
    const apply = getByRole("button", { name: "Apply custom RGB" }) as HTMLButtonElement;
    expect(queryByRole("checkbox")).toBeNull();
    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);

    await waitFor(() => expect(controller.sent).toHaveLength(10));
    expect(getByRole("button", { name: "Stop live RGB" })).toBeTruthy();
  });

  test("keeps streaming while live RGB is active", async () => {
    vi.useFakeTimers();
    const { controller, getByRole } = await renderEditor();
    fireEvent.click(getByRole("button", { name: "Apply custom RGB" }));
    await act(async () => Promise.resolve());
    expect(controller.sent).toHaveLength(10);

    await act(async () => vi.advanceTimersByTimeAsync(130));
    expect(controller.sent).toHaveLength(20);
    fireEvent.click(getByRole("button", { name: "Stop live RGB" }));
    await act(async () => vi.advanceTimersByTimeAsync(260));
    expect(controller.sent).toHaveLength(20);
  });
});
