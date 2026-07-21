import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
// biome-ignore lint/correctness/noUnusedImports: required by this test file's classic JSX transform
import React from "react";
import { afterEach, describe, expect, test } from "vitest";
import { DeviceSessionProvider } from "../../device/DeviceSession";
import { MockDeviceController } from "../../device/mock-controller";
import { SET_CUSTOM_LED_COMMAND } from "../../protocol/custom-lighting";
import { CustomLightingEditor } from "../CustomLightingEditor";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

async function renderEditor(commandTransport: boolean) {
  const controller = new MockDeviceController({ commandTransport });
  await controller.connect();
  const view = render(
    <DeviceSessionProvider controller={controller}>
      <CustomLightingEditor />
    </DeviceSessionProvider>,
  );
  return { controller, ...view };
}

describe("CustomLightingEditor", () => {
  test("keeps hardware actions disabled without the optional command interface", async () => {
    const view = await renderEditor(false);
    expect(view.getByText("Command interface unavailable")).toBeTruthy();
    expect(
      (view.getByRole("button", { name: "Read current layout" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (view.getByRole("button", { name: "Apply custom RGB" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  test("paints individual keys and supports fill and clear", async () => {
    const view = await renderEditor(true);
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
    const view = await renderEditor(true);
    const esc = view.getByRole("button", { name: "Esc, LED 0" });
    const f1 = view.getByRole("button", { name: "F1, LED 1" });
    expect(esc.getAttribute("tabindex")).toBe("0");
    expect(f1.getAttribute("tabindex")).toBe("-1");

    esc.focus();
    fireEvent.keyDown(esc, { key: "ArrowRight" });
    expect(document.activeElement).toBe(f1);
    expect(f1.getAttribute("tabindex")).toBe("0");
  });

  test("requires acknowledgement, backs up, then applies custom RGB", async () => {
    const { controller, getByLabelText, getByRole } = await renderEditor(true);
    const apply = getByRole("button", { name: "Apply custom RGB" }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.click(getByLabelText(/I understand that custom RGB/i));
    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);

    await waitFor(() => expect(controller.commandRequests).toHaveLength(4));
    expect(controller.commandRequests.at(-1)?.command).toBe(SET_CUSTOM_LED_COMMAND);
  });
});
