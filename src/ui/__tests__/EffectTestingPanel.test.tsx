import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
// biome-ignore lint/correctness/noUnusedImports: required by this test file's classic JSX transform
import React from "react";
import { afterEach, describe, expect, test } from "vitest";
import { DeviceSessionProvider } from "../../device/DeviceSession";
import { MockDeviceController } from "../../device/mock-controller";
import { LightingMode } from "../../protocol/lighting";
import { EffectTestingPanel } from "../EffectTestingPanel";
import { LightingPanel } from "../LightingPanel";

afterEach(cleanup);

describe("EffectTestingPanel", () => {
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
    fireEvent.click(testing.getByRole("button", { name: "Start test" }));
    await waitFor(() => expect(testingController.sent).toHaveLength(8));

    expect(
      testingController.sent.map(({ reportId, bytes }) => ({ reportId, bytes: [...bytes] })),
    ).toEqual(
      lightingController.sent.map(({ reportId, bytes }) => ({ reportId, bytes: [...bytes] })),
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

    fireEvent.change(view.getByLabelText("Note · required for Wrong effect"), {
      target: { value: "steady red" },
    });
    fireEvent.click(view.getByRole("button", { name: /Works/ }));

    const report = view.getByLabelText(/Copy this report/) as HTMLTextAreaElement;
    expect(report.value).toContain("Mode 1 / Steady: Works — steady red");

    await waitFor(() => expect(view.getByRole("heading", { name: "Key Press — Light Up" })).toBeTruthy());
    await waitFor(() => expect(controller.sent).toHaveLength(8));
    expect(controller.sent.at(-2)?.reportId).toBe(LightingMode.SingleOn);
  });
});
