// biome-ignore lint/correctness/noUnusedImports: required by this test file's classic JSX transform
import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Configurator } from "../App";
import { DeviceSessionProvider, useDeviceSession } from "../device/DeviceSession";
import { MockDeviceController } from "../device/mock-controller";

afterEach(cleanup);

function StartCustomRgbOperation() {
  const { runOperation } = useDeviceSession();
  return (
    <button
      type="button"
      onClick={() => {
        void runOperation("custom RGB", () => new Promise(() => {}));
      }}
    >
      Start custom RGB operation
    </button>
  );
}

describe("Configurator operation feedback", () => {
  test("does not insert a global banner while custom RGB is running", async () => {
    const controller = new MockDeviceController();
    await controller.connect();
    const view = render(
      <DeviceSessionProvider controller={controller}>
        <Configurator />
        <StartCustomRgbOperation />
      </DeviceSessionProvider>,
    );

    fireEvent.click(view.getByRole("button", { name: "Start custom RGB operation" }));

    expect(view.queryByText("Device operation: custom RGB")).toBeNull();
  });
});
