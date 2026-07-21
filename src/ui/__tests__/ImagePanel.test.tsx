// biome-ignore lint/correctness/noUnusedImports: required by this test file's classic JSX transform
import React from "react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
import { MockDeviceController } from "../../device/mock-controller";
import { DeviceSessionProvider } from "../../device/DeviceSession";
import { ImagePanel } from "../ImagePanel";
import { IMAGE_PRESETS } from "../../image/presets";

function renderPanel(controller: MockDeviceController) {
  return render(
    <DeviceSessionProvider controller={controller}>
      <ImagePanel />
    </DeviceSessionProvider>,
  );
}

describe("ImagePanel", () => {
  test("file input is disabled when not connected", () => {
    const ctrl = new MockDeviceController();
    const { container } = renderPanel(ctrl);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.multiple).toBe(true);
  });

  test("upload button is disabled when no file is prepared", () => {
    const ctrl = new MockDeviceController();
    const { getByRole } = renderPanel(ctrl);
    const btn = getByRole("button", { name: /upload/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("offers every bundled image as a preset", async () => {
    const ctrl = new MockDeviceController();
    await ctrl.connect();
    const { getByRole } = renderPanel(ctrl);

    for (const preset of IMAGE_PRESETS) {
      expect(getByRole("button", { name: preset.name })).toBeTruthy();
    }
  });

  test("processes and uploads a bundled image through the device pipeline", async () => {
    const ctrl = new MockDeviceController();
    await ctrl.connect();
    const preset = IMAGE_PRESETS.find(({ fileName }) => fileName === "java_duke.jpeg");
    if (!preset) throw new Error("Java Duke preset missing");
    const bytes = await readFile(join(process.cwd(), "images", preset.fileName));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(bytes, { headers: { "content-type": preset.mimeType } }),
    );
    const view = renderPanel(ctrl);

    fireEvent.click(view.getByRole("button", { name: preset.name }));
    await waitFor(() => expect(view.getByRole("status").textContent).toContain("1 image ready"));
    fireEvent.click(view.getByRole("button", { name: "Upload image to keyboard" }));
    await waitFor(() => expect(view.getByRole("status").textContent).toBe("Uploaded"));

    expect(ctrl.sent.filter(({ kind }) => kind === "output")).toHaveLength(9);
    expect(ctrl.sent.filter(({ kind }) => kind === "feature")).toHaveLength(3);
  });
});
