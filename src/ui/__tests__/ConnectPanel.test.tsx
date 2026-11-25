import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";

afterEach(cleanup);

import { DeviceSessionProvider } from "../../device/DeviceSession";
import { MockDeviceController } from "../../device/mock-controller";
import { ConnectPanel } from "../ConnectPanel";

function renderPanel(controller = new MockDeviceController()) {
  return render(
    <DeviceSessionProvider controller={controller}>
      <ConnectPanel />
    </DeviceSessionProvider>,
  );
}

describe("ConnectPanel", () => {
  test("renders a hint about wired USB connection", () => {
    const ctrl = new MockDeviceController();
    const { getByText } = renderPanel(ctrl);
    // The hint must mention both the USB-C cable and the wired-mode switch,
    // since the TFT configuration interface is not exposed over Bluetooth
    // or the 2.4 GHz dongle.
    expect(getByText(/USB-C/i)).toBeTruthy();
    expect(getByText(/wired/i)).toBeTruthy();
  });

  test("renders Connect button when not connected", () => {
    const ctrl = new MockDeviceController();
    const { getByRole } = renderPanel(ctrl);
    const btn = getByRole("button", { name: /connect keyboard/i });
    expect(btn).toBeTruthy();
  });

  test("shows when the connected USB interfaces are open without polling firmware", async () => {
    const ctrl = new MockDeviceController();
    await ctrl.connect();
    const { getByRole } = renderPanel(ctrl);

    expect(getByRole("status").textContent).toContain("USB interfaces open");
    expect(ctrl.featureReads).toBe(0);
  });
});
