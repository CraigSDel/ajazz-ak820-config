import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
// biome-ignore lint/correctness/noUnusedImports: required by this test file's classic JSX transform
import React from "react";
import { afterEach, describe, expect, test } from "vitest";
import { DeviceSessionProvider } from "../../device/DeviceSession";
import { MockDeviceController } from "../../device/mock-controller";
import { LightingPanel } from "../LightingPanel";

afterEach(cleanup);

async function renderPanel(controller = new MockDeviceController()) {
  await controller.connect();
  const view = render(
    <DeviceSessionProvider controller={controller}>
      <LightingPanel />
    </DeviceSessionProvider>,
  );
  return { controller, ...view };
}

describe("LightingPanel", () => {
  test("previews the selected color on a virtual AK820 Pro keyboard", async () => {
    const view = await renderPanel();
    const preview = view.getByLabelText(/Virtual AK820 Pro lighting preview/);
    expect(preview.getAttribute("aria-label")).toContain("#ff0000");
    expect(preview.getAttribute("aria-label")).toContain("provisional simulation");

    fireEvent.change(view.getByLabelText("Lighting color"), { target: { value: "#123456" } });
    expect(preview.getAttribute("aria-label")).toContain("#123456");
  });

  test("matches the ANSI AK820 Pro hardware layout", async () => {
    const view = await renderPanel();
    const preview = view.getByLabelText(/Virtual AK820 Pro lighting preview/);
    expect(preview.querySelectorAll(".keyboard-key")).toHaveLength(81);
    expect(preview.querySelector(".keyboard-knob")).toBeTruthy();
    expect(preview.querySelector(".keyboard-screen")).toBeTruthy();
    expect(preview.querySelector(".keyboard-status-lights")?.textContent).toBe("CW");
    expect(preview.querySelectorAll(".is-accent-key")).toHaveLength(3);
  });

  test("offers quick color swatches without replacing the full color picker", async () => {
    const view = await renderPanel();
    fireEvent.click(view.getByRole("button", { name: "Use color #0a84ff" }));
    expect((view.getByLabelText("Lighting color") as HTMLInputElement).value).toBe("#0a84ff");
    expect(
      view.getByLabelText(/Virtual AK820 Pro lighting preview/).getAttribute("aria-label"),
    ).toContain("#0a84ff");
  });

  test("uses the AK820 Pro 1 through 5 preset levels and allows RGB steady lighting", async () => {
    const view = await renderPanel();
    const brightness = view.getByLabelText("Brightness") as HTMLInputElement;
    expect(brightness.min).toBe("1");
    expect(brightness.max).toBe("5");
    expect(view.getByText("Built-in multicolor palette")).toBeTruthy();
  });

  test("uses presentation metadata to name and animate a protocol effect", async () => {
    const view = await renderPanel();
    const preview = view.getByLabelText(/Virtual AK820 Pro lighting preview/);

    selectEffect(view, "Scrolling");

    expect(preview.classList.contains("is-cross-wave")).toBe(true);
    expect(preview.getAttribute("aria-label")).toContain("Scrolling effect");
  });

  test("keeps the opaque accent keycaps unlit during Colourful and Spectrum Cycle", async () => {
    const view = await renderPanel();
    const preview = view.getByLabelText(/Virtual AK820 Pro lighting preview/);

    selectEffect(view, "Colourful");
    expect(preview.querySelectorAll(".is-accent-key.is-light-blocked")).toHaveLength(3);

    selectEffect(view, "Spectrum Cycle");
    expect(preview.querySelectorAll(".is-accent-key.is-light-blocked")).toHaveLength(3);

    selectEffect(view, "Static");
    expect(preview.querySelectorAll(".is-light-blocked")).toHaveLength(0);
  });

  test("shows only the directions supported by the selected mode", async () => {
    const view = await renderPanel();
    expect(view.queryByLabelText("Direction")).toBeNull();
    selectEffect(view, "Scrolling");
    expect(view.getByLabelText("Direction").textContent).toContain("Up");
    expect(view.getByLabelText("Direction").textContent).toContain("Down");

    selectEffect(view, "Rolling");
    expect(view.getByLabelText("Direction").textContent).toContain("Left");
    expect(view.getByLabelText("Direction").textContent).toContain("Right");

    selectEffect(view, "Rotating");
    expect(view.getByLabelText("Direction").textContent).toContain("Left");

    selectEffect(view, "Static");
    expect(view.queryByLabelText("Direction")).toBeNull();
  });

  test("switches the same workspace between effect preview and per-key editing", async () => {
    const view = await renderPanel();
    const canvas = view.container.querySelector('[data-keyboard-canvas="ak820"]');
    const firstKey = canvas?.querySelector(".keyboard-key");

    expect(view.queryByLabelText("Custom paint color")).toBeNull();
    expect(view.queryByLabelText("RGB lighting status")).toBeNull();
    expect(view.getAllByLabelText(/AK820 Pro/)).toHaveLength(1);
    fireEvent.click(view.getByRole("button", { name: "Per-key" }));
    expect(view.getByRole("note").textContent).toContain("does not store custom per-key layouts");
    expect(view.getByLabelText("Custom paint color")).toBeTruthy();
    expect(view.getAllByLabelText(/AK820 Pro/)).toHaveLength(1);
    expect(view.queryByLabelText("Lighting effect")).toBeNull();
    expect(view.container.querySelector('[data-keyboard-canvas="ak820"]')).toBe(canvas);
    expect(canvas?.querySelector(".keyboard-key")).toBe(firstKey);
  });

  test("preserves the per-key draft when switching modes", async () => {
    const view = await renderPanel();
    fireEvent.click(view.getByRole("button", { name: "Per-key" }));
    fireEvent.change(view.getByLabelText("Custom paint color"), { target: { value: "#123456" } });
    fireEvent.click(view.getByRole("button", { name: "Q, LED 33" }));

    fireEvent.click(view.getByRole("button", { name: "Effects" }));
    fireEvent.click(view.getByRole("button", { name: "Per-key" }));

    expect(view.getByRole("button", { name: "Q, LED 33" }).getAttribute("style")).toContain(
      "#123456",
    );
  });

  test("stops live per-key streaming when switching to effects", async () => {
    const view = await renderPanel();
    fireEvent.click(view.getByRole("button", { name: "Per-key" }));
    fireEvent.click(view.getByRole("button", { name: "Apply custom RGB" }));
    await waitFor(() => expect(view.getByRole("button", { name: "Stop live RGB" })).toBeTruthy());

    fireEvent.click(view.getByRole("button", { name: "Effects" }));
    fireEvent.click(view.getByRole("button", { name: "Per-key" }));
    expect(view.getByRole("button", { name: "Apply custom RGB" })).toBeTruthy();
  });

  test("hides controls which the effect metadata marks unsupported", async () => {
    const view = await renderPanel();
    expect(view.queryByLabelText("Speed")).toBeNull();
    selectEffect(view, "Spectrum Cycle");
    expect(view.queryByLabelText("Lighting color")).toBeNull();
    expect(view.queryByText("Built-in multicolor palette")).toBeNull();
    expect(view.getByLabelText("Speed")).toBeTruthy();
  });

  test("previews reactive presentation metadata on pointer input", async () => {
    const view = await renderPanel();
    selectEffect(view, "Ripples");
    const preview = view.getByLabelText(/Virtual AK820 Pro lighting preview/);
    expect(preview.classList.contains("has-preview-trigger")).toBe(false);
    const key = preview.querySelector(".keyboard-key") as HTMLElement;
    fireEvent.pointerDown(key);
    expect(preview.classList.contains("has-preview-trigger")).toBe(true);
    expect(key.classList.contains("is-preview-origin")).toBe(true);
  });

  test("includes side keys in reactive geometry", async () => {
    const view = await renderPanel();
    selectEffect(view, "Ripples");
    const preview = view.getByLabelText(/Virtual AK820 Pro lighting preview/);
    const sideKey = preview.querySelector(".keyboard-side .is-navigation") as HTMLElement;

    expect(sideKey.getAttribute("style")).toContain("--key-x");
    fireEvent.pointerDown(sideKey);
    expect(sideKey.classList.contains("is-preview-origin")).toBe(true);
  });

  test("maps firmware speed levels to profile durations", async () => {
    const view = await renderPanel();
    selectEffect(view, "Breath");
    const preview = view.getByLabelText(/Virtual AK820 Pro lighting preview/);

    fireEvent.change(view.getByLabelText("Speed"), { target: { value: "1" } });
    expect(preview.getAttribute("style")).toContain("--effect-speed: 2.4s");
    fireEvent.change(view.getByLabelText("Speed"), { target: { value: "5" } });
    expect(preview.getAttribute("style")).toContain("--effect-speed: 0.8s");
  });

  test("submits lighting through the device transaction", async () => {
    const { controller, getByRole, getByText, queryByRole } = await renderPanel();
    fireEvent.click(getByRole("button", { name: "Apply to keyboard" }));
    expect((getByRole("button", { name: "Applying…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(queryByRole("status")).toBeNull();
    await waitFor(() => expect(controller.sent).toHaveLength(4));
    await waitFor(() => expect(getByText(/Lighting applied/)).toBeTruthy());
  });

  test("displays a lighting transfer failure", async () => {
    const controller = new MockDeviceController({ failSendAt: 1 });
    const view = await renderPanel(controller);
    fireEvent.click(view.getByRole("button", { name: "Apply to keyboard" }));
    await waitFor(() => expect(view.getByRole("status").textContent).toMatch(/Transfer failed/));
  });

  test("marks changes as applied while allowing the same effect to be reapplied", async () => {
    const { controller, ...view } = await renderPanel();
    fireEvent.click(view.getByRole("button", { name: "Apply to keyboard" }));
    await waitFor(() => expect(view.getByText(/Lighting applied/)).toBeTruthy());

    const reapply = view.getByRole("button", {
      name: "Reapply to keyboard",
    }) as HTMLButtonElement;
    const reportsPerWrite = controller.sent.length;
    expect(reportsPerWrite).toBeGreaterThan(0);
    expect(reapply.disabled).toBe(false);
    fireEvent.click(reapply);
    expect(view.getByRole("button", { name: "Applying…" })).toBeTruthy();
    await waitFor(() =>
      expect(view.getByRole("button", { name: "Reapply to keyboard" })).toBeTruthy(),
    );
    expect(controller.sent).toHaveLength(reportsPerWrite * 2);

    fireEvent.change(view.getByLabelText("Brightness"), { target: { value: "4" } });
    expect(view.getByRole("button", { name: "Apply to keyboard" })).toBeTruthy();
    expect(view.getByText("Not applied")).toBeTruthy();
  });

  test("hides irrelevant controls when lighting is off", async () => {
    const view = await renderPanel();
    selectEffect(view, "Off");
    expect(view.queryByLabelText("Brightness")).toBeNull();
    expect(view.queryByLabelText("Lighting color")).toBeNull();
  });

  test("submits the selected sleep timeout", async () => {
    const { controller, getByLabelText, getByRole, getByText } = await renderPanel();
    fireEvent.change(getByLabelText("Lighting sleep timeout"), { target: { value: "1" } });
    fireEvent.click(getByRole("button", { name: "Apply sleep timeout" }));
    await waitFor(() => expect(controller.sent).toHaveLength(3));
    expect(controller.sent[2].bytes[7]).toBe(1);
    await waitFor(() => expect(getByText("Sleep timeout applied")).toBeTruthy());
  });
});

function selectEffect(view: Awaited<ReturnType<typeof renderPanel>>, name: string) {
  fireEvent.click(view.getByLabelText("Lighting effect"));
  fireEvent.click(view.getByRole("button", { name }));
}
