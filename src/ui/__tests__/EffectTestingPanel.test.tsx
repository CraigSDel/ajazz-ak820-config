import { cleanup, fireEvent, render, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DeviceSessionProvider } from "../../device/DeviceSession";
import { MockDeviceController } from "../../device/mock-controller";
import { LightingMode } from "../../protocol/lighting";
import { EffectTestingPanel } from "../EffectTestingPanel";
import { LightingPanel } from "../LightingPanel";

afterEach(cleanup);

describe("EffectTestingPanel", () => {
  test("never writes to the keyboard just by being opened", async () => {
    const controller = new MockDeviceController();
    await controller.connect();
    const view = render(
      <DeviceSessionProvider controller={controller}>
        <EffectTestingPanel />
      </DeviceSessionProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(controller.sent).toHaveLength(0);
    expect(view.getByRole("button", { name: "Apply to keyboard" })).toBeTruthy();
  });

  const clipboardWrite = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    clipboardWrite.mockClear();
  });

  test("uses the exact same lighting transaction as the Lighting workspace", async () => {
    localStorage.clear();
    const lightingController = new MockDeviceController();
    await lightingController.connect();
    const lighting = render(
      <DeviceSessionProvider controller={lightingController}>
        <LightingPanel />
      </DeviceSessionProvider>,
    );
    fireEvent.click(lighting.getByRole("button", { name: "Apply to keyboard" }));
    await waitFor(() => expect(lightingController.sent).toHaveLength(8));
    lighting.unmount();

    const testingController = new MockDeviceController();
    await testingController.connect();
    const testing = render(
      <DeviceSessionProvider controller={testingController}>
        <EffectTestingPanel />
      </DeviceSessionProvider>,
    );
    fireEvent.click(testing.getByRole("button", { name: "Apply to keyboard" }));
    await waitFor(() => expect(testingController.sent).toHaveLength(8));

    expect(testingController.sent.map(({ kind, bytes }) => ({ kind, bytes: [...bytes] }))).toEqual(
      lightingController.sent.map(({ kind, bytes }) => ({ kind, bytes: [...bytes] })),
    );
  });

  test("records a result and selects and applies the next untested effect", async () => {
    localStorage.clear();
    const controller = new MockDeviceController();
    await controller.connect();
    const view = render(
      <DeviceSessionProvider controller={controller}>
        <EffectTestingPanel />
      </DeviceSessionProvider>,
    );

    const works = view.getByRole("button", { name: /Works/ }) as HTMLButtonElement;
    // Results can't be recorded for an effect that was never shown.
    expect(works.disabled).toBe(true);
    fireEvent.click(view.getByRole("button", { name: "Apply to keyboard" }));
    await waitFor(() => expect(controller.sent).toHaveLength(8));

    fireEvent.input(view.getByLabelText("Note · required for Wrong effect"), {
      target: { value: "steady red" },
    });
    await waitFor(() => expect(works.disabled).toBe(false));
    fireEvent.click(works);

    const report = view.getByLabelText("Current test report") as HTMLTextAreaElement;
    await waitFor(() =>
      expect(report.value).toContain("Protocol effect 1 / Static: Works — steady red"),
    );
    expect(clipboardWrite).not.toHaveBeenCalled();

    fireEvent.click(view.getByRole("button", { name: "Copy report to clipboard" }));
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith(report.value));

    await waitFor(() => expect(view.getByRole("heading", { name: "Single Key On" })).toBeTruthy());
    await waitFor(() => expect(controller.sent).toHaveLength(16));
    expect(controller.sent.at(-2)?.bytes[0]).toBe(LightingMode.SingleKeyOn);
  });

  test("reattempts the selected RGB effect and records it in the exported result", async () => {
    localStorage.clear();
    const controller = new MockDeviceController();
    await controller.connect();
    const view = render(
      <DeviceSessionProvider controller={controller}>
        <EffectTestingPanel />
      </DeviceSessionProvider>,
    );

    fireEvent.click(view.getByRole("button", { name: "Apply to keyboard" }));
    await waitFor(() => expect(controller.sent).toHaveLength(8));
    const reattempt = (await view.findByRole("button", {
      name: "Reattempt RGB",
    })) as HTMLButtonElement;
    await waitFor(() => expect(reattempt.disabled).toBe(false));
    fireEvent.click(reattempt);

    await waitFor(() => expect(controller.sent).toHaveLength(16));
    const report = view.getByLabelText("Current test report") as HTMLTextAreaElement;
    await waitFor(() =>
      expect(report.value).toContain("Protocol effect 1 / Static: Untested — RGB reapplied 1 time"),
    );

    await waitFor(() => expect(reattempt.disabled).toBe(false));
    fireEvent.click(reattempt);
    await waitFor(() => expect(controller.sent).toHaveLength(24));
    await waitFor(() =>
      expect(report.value).toContain(
        "Protocol effect 1 / Static: Untested — RGB reapplied 2 times",
      ),
    );
  });
});
