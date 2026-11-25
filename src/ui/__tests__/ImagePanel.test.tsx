import { cleanup, fireEvent, render, waitFor } from "@testing-library/preact";
import { createCanvas } from "canvas";
import GIFEncoder from "gif-encoder-2";
import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

import { DeviceSessionProvider } from "../../device/DeviceSession";
import { MockDeviceController } from "../../device/mock-controller";
import { IMAGE_PRESETS } from "../../image/presets";
import { ImagePanel } from "../ImagePanel";

function renderPanel(controller: MockDeviceController) {
  return render(
    <DeviceSessionProvider controller={controller}>
      <ImagePanel />
    </DeviceSessionProvider>,
  );
}

describe("ImagePanel", () => {
  test("prepares a preview without a keyboard but only sends once connected", async () => {
    const ctrl = new MockDeviceController();
    mockPresetFetch("java_duke.webp");
    const view = renderPanel(ctrl);
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.disabled).toBe(false);
    expect(input.multiple).toBe(true);

    fireEvent.click(view.getByRole("button", { name: "Java Duke" }));
    await waitFor(() => expect(view.getByRole("status").textContent).toContain("1 image ready"));
    const send = view.getByRole("button", {
      name: "Upload image to keyboard",
    }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    expect(view.getByText(/Connect your keyboard on the Device tab/)).toBeTruthy();
    expect(ctrl.sent).toHaveLength(0);
  });

  test("reprocesses the same file when it is chosen again", async () => {
    const ctrl = new MockDeviceController();
    const bytes = pngBytes();
    const view = renderPanel(ctrl);
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    const choose = () => {
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [new File([bytes], "sunset.png", { type: "image/png" })],
      });
      fireEvent.change(input);
    };

    choose();
    await waitFor(() => expect(view.getByRole("status").textContent).toContain("1 image ready"));
    expect(input.value).toBe("");
    choose();
    await waitFor(() => expect(view.getByRole("status").textContent).toContain("1 image ready"));
  });

  test("names the file that could not be prepared in a multi-file selection", async () => {
    const ctrl = new MockDeviceController();
    const bytes = pngBytes();
    const view = renderPanel(ctrl);
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [
        new File([bytes], "sunset.png", { type: "image/png" }),
        new File(["not an image"], "notes.txt", { type: "text/plain" }),
      ],
    });
    fireEvent.change(input);
    await waitFor(() =>
      expect(view.getByRole("status").textContent).toMatch(/“notes.txt”: Unsupported image type/),
    );
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
    const preset = mockPresetFetch("java_duke.webp");
    const view = renderPanel(ctrl);

    fireEvent.click(view.getByRole("button", { name: preset.name }));
    await waitFor(() => expect(view.getByRole("status").textContent).toContain("1 image ready"));
    fireEvent.click(view.getByRole("button", { name: "Upload image to keyboard" }));
    await waitFor(() => expect(view.getByRole("status").textContent).toBe("Uploaded"));

    expect(ctrl.sent.filter(({ kind }) => kind === "output")).toHaveLength(9);
    expect(ctrl.sent.filter(({ kind }) => kind === "feature")).toHaveLength(3);
  });

  test("uploads an animation with its frame timing", async () => {
    const ctrl = new MockDeviceController();
    await ctrl.connect();
    const view = renderPanel(ctrl);
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File([makeGif(24, 80)], "spin.gif", { type: "image/gif" })],
    });
    fireEvent.change(input);
    await waitFor(() => expect(view.getByRole("status").textContent).toContain("24 frames"));
    fireEvent.click(view.getByRole("button", { name: "Upload image to keyboard" }));
    await waitFor(() => expect(view.getByRole("status").textContent).toBe("Uploaded"));

    // 256-byte header + 24 × 32768 px bytes → 193 chunks of 4096.
    expect(ctrl.sent.filter(({ kind }) => kind === "output")).toHaveLength(193);
    const header = ctrl.sent.find(({ kind }) => kind === "output")?.bytes;
    expect(header?.[0]).toBe(24);
    expect(header?.[1]).toBe(40); // 80 ms in 2 ms units
  });
});

function makeGif(frameCount: number, delayMs: number): Uint8Array {
  const encoder = new GIFEncoder(16, 16);
  encoder.start();
  encoder.setDelay(delayMs);
  const canvas = createCanvas(16, 16);
  const ctx = canvas.getContext("2d");
  for (let frame = 0; frame < frameCount; frame++) {
    ctx.fillStyle = `hsl(${(frame * 15) % 360} 80% 50%)`;
    ctx.fillRect(0, 0, 16, 16);
    encoder.addFrame(ctx as unknown as CanvasRenderingContext2D);
  }
  encoder.finish();
  return new Uint8Array(encoder.out.getData());
}

/** Serve a preset as a PNG: jsdom's canvas can't decode the shipped WebP. */
function mockPresetFetch(fileName: string) {
  const preset = IMAGE_PRESETS.find((candidate) => candidate.fileName === fileName);
  if (!preset) throw new Error(`${fileName} preset missing`);
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    const canvas = createCanvas(128, 128);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#3366cc";
    ctx.fillRect(0, 0, 128, 128);
    return new Response(new Uint8Array(canvas.toBuffer("image/png")), {
      headers: { "content-type": "image/png" },
    });
  });
  return preset;
}

function pngBytes(): Uint8Array {
  const canvas = createCanvas(64, 32);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#cc6633";
  ctx.fillRect(0, 0, 64, 32);
  return new Uint8Array(canvas.toBuffer("image/png"));
}
