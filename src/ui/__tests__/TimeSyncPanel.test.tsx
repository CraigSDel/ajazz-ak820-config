import { cleanup, fireEvent, render, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";

afterEach(cleanup);

import { DeviceSessionProvider } from "../../device/DeviceSession";
import { MockDeviceController } from "../../device/mock-controller";
import { ConnectPanel } from "../ConnectPanel";
import { TimeSyncPanel } from "../TimeSyncPanel";

function renderPanel(controller: MockDeviceController) {
  return render(
    <DeviceSessionProvider controller={controller}>
      <TimeSyncPanel />
    </DeviceSessionProvider>,
  );
}

describe("TimeSyncPanel", () => {
  test("clicking 'Sync Now' sends the 4-packet time-sync sequence", async () => {
    const ctrl = new MockDeviceController();
    await ctrl.connect();
    const { getByRole, getByText } = renderPanel(ctrl);
    fireEvent.click(getByRole("button", { name: /sync/i }));
    // Time sync is 4 reports.
    await waitFor(() => expect(ctrl.sent.length).toBe(4));
    await waitFor(() => expect(getByText(/Clock set to/)).toBeTruthy());
  });

  test("button is disabled when not connected", () => {
    const ctrl = new MockDeviceController();
    const { getByRole } = renderPanel(ctrl);
    expect((getByRole("button", { name: /sync/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("syncs the clock automatically when the keyboard connects", async () => {
    const ctrl = new MockDeviceController();
    const view = render(
      <DeviceSessionProvider controller={ctrl}>
        <ConnectPanel />
        <TimeSyncPanel />
      </DeviceSessionProvider>,
    );
    fireEvent.click(view.getByRole("button", { name: "Connect keyboard" }));
    await waitFor(() => expect(ctrl.sent).toHaveLength(4));
    await waitFor(() => expect(view.getByText(/Clock set to/)).toBeTruthy());
  });

  test("respects a saved preference to skip automatic sync", async () => {
    const ctrl = new MockDeviceController();
    const first = render(
      <DeviceSessionProvider controller={ctrl}>
        <TimeSyncPanel />
      </DeviceSessionProvider>,
    );
    fireEvent.click(first.getByLabelText("Sync automatically when the keyboard connects"));
    first.unmount();

    const view = render(
      <DeviceSessionProvider controller={ctrl}>
        <ConnectPanel />
        <TimeSyncPanel />
      </DeviceSessionProvider>,
    );
    expect(
      (view.getByLabelText("Sync automatically when the keyboard connects") as HTMLInputElement)
        .checked,
    ).toBe(false);
    fireEvent.click(view.getByRole("button", { name: "Connect keyboard" }));
    await waitFor(() => expect(view.getByRole("button", { name: "Disconnect" })).toBeTruthy());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(ctrl.sent).toHaveLength(0);
  });
});
