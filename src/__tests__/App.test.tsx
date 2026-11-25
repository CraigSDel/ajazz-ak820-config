import { cleanup, fireEvent, render } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { Configurator } from "../App";
import { DeviceSessionProvider } from "../device/DeviceSession";
import { MockDeviceController } from "../device/mock-controller";

afterEach(cleanup);

function renderConfigurator(showTesting = true) {
  return render(
    <DeviceSessionProvider controller={new MockDeviceController()}>
      <Configurator showTesting={showTesting} />
    </DeviceSessionProvider>,
  );
}

describe("Configurator workspace", () => {
  test("shows the hardware risk warning", () => {
    const view = renderConfigurator();
    expect(
      view.getByRole("complementary", { name: "Important safety notice" }).textContent,
    ).toMatch(/use at your own risk/i);
  });

  test("opens on lighting and reveals one task workspace at a time", async () => {
    const view = renderConfigurator();

    expect(view.getByRole("heading", { name: "Lighting" })).toBeTruthy();
    expect(view.queryByRole("heading", { name: "Display image" })).toBeNull();

    fireEvent.click(view.getByRole("button", { name: "Display: TFT image upload" }));
    expect(view.getByRole("heading", { name: "Display image" })).toBeTruthy();
    expect(view.queryByLabelText("Lighting effect")).toBeNull();

    fireEvent.click(view.getByRole("button", { name: "Testing: Hardware effect validation" }));
    expect(view.getByRole("heading", { name: "Testing" })).toBeTruthy();
    expect(await view.findByRole("heading", { name: "Static" })).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "Device: Connection and time" }));
    expect(view.getByRole("heading", { name: "Device" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Connect keyboard" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Sync now" })).toBeTruthy();
  });

  test("can hide the hardware testing workspace", () => {
    const view = renderConfigurator(false);
    expect(view.queryByRole("button", { name: /Testing:/ })).toBeNull();
  });

  test("hides the hardware testing workspace unless explicitly enabled", () => {
    const view = render(
      <DeviceSessionProvider controller={new MockDeviceController()}>
        <Configurator />
      </DeviceSessionProvider>,
    );
    expect(view.queryByRole("button", { name: /Testing:/ })).toBeNull();
  });

  test("connection summary is a shortcut to device settings", () => {
    const view = renderConfigurator();

    fireEvent.click(view.getByRole("button", { name: /Open device settings/ }));
    expect(view.getByRole("heading", { name: "Device" })).toBeTruthy();
  });
});
