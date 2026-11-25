import { cleanup, fireEvent, render, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { DeviceSessionProvider, useDeviceSession } from "../DeviceSession";
import { MockDeviceController } from "../mock-controller";

afterEach(cleanup);

function SessionProbe({ firstWork }: { firstWork: () => Promise<void> }) {
  const { activeOperation, connected, runOperation } = useDeviceSession();
  const startFirst = () =>
    runOperation("lighting", firstWork).catch((error: Error) => {
      document.body.dataset.firstError = error.message;
    });
  const startSecond = () =>
    runOperation("time sync", async () => {}).catch((error: Error) => {
      document.body.dataset.overlapError = error.message;
    });
  return (
    <>
      <p>{activeOperation ?? "idle"}</p>
      <p data-testid="connection-state">{`${connected}`}</p>
      <button type="button" onClick={startFirst}>
        first
      </button>
      <button type="button" onClick={startSecond}>
        second
      </button>
    </>
  );
}

describe("DeviceSessionProvider", () => {
  test("rejects overlapping operations and releases the lock after completion", async () => {
    const controller = new MockDeviceController();
    await controller.connect();
    let finish: () => void = () => {};
    const work = () => new Promise<void>((resolve) => (finish = resolve));
    const view = render(
      <DeviceSessionProvider controller={controller}>
        <SessionProbe firstWork={work} />
      </DeviceSessionProvider>,
    );

    fireEvent.click(view.getByRole("button", { name: "first" }));
    expect(view.getByText("lighting")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "second" }));
    await waitFor(() => expect(document.body.dataset.overlapError).toMatch(/lighting/));

    finish();
    await waitFor(() => expect(view.getByText("idle")).toBeTruthy());
    delete document.body.dataset.overlapError;
  });

  test("releases the lock when an operation fails or times out", async () => {
    const controller = new MockDeviceController();
    await controller.connect();
    const work = () => Promise.reject(new Error("Operation timed out"));
    const view = render(
      <DeviceSessionProvider controller={controller}>
        <SessionProbe firstWork={work} />
      </DeviceSessionProvider>,
    );

    fireEvent.click(view.getByRole("button", { name: "first" }));
    await waitFor(() => expect(document.body.dataset.firstError).toMatch(/timed out/));
    expect(view.getByText("idle")).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "second" }));
    await waitFor(() => expect(view.getByText("idle")).toBeTruthy());
    delete document.body.dataset.firstError;
  });

  test("clears an active operation after physical disconnect", async () => {
    const controller = new MockDeviceController();
    await controller.connect();
    const work = () => new Promise<void>(() => {});
    const view = render(
      <DeviceSessionProvider controller={controller}>
        <SessionProbe firstWork={work} />
      </DeviceSessionProvider>,
    );

    fireEvent.click(view.getByRole("button", { name: "first" }));
    expect(view.getByText("lighting")).toBeTruthy();
    await controller.disconnect();
    await waitFor(() => expect(view.getByText("idle")).toBeTruthy());
  });

  test("does not publish operation success after a physical disconnect", async () => {
    const controller = new MockDeviceController();
    await controller.connect();
    let finish: () => void = () => {};
    const work = () => new Promise<void>((resolve) => (finish = resolve));
    const view = render(
      <DeviceSessionProvider controller={controller}>
        <SessionProbe firstWork={work} />
      </DeviceSessionProvider>,
    );

    fireEvent.click(view.getByRole("button", { name: "first" }));
    await controller.disconnect();
    finish();

    await waitFor(() => expect(view.getByTestId("connection-state").textContent).toBe("false"));
    await waitFor(() => expect(document.body.dataset.firstError).toMatch(/disconnected/i));
    delete document.body.dataset.firstError;
  });

  test("background operations hold the lock without publishing activeOperation", async () => {
    const controller = new MockDeviceController();
    await controller.connect();
    const captured: { session?: ReturnType<typeof useDeviceSession> } = {};
    function Capture() {
      const session = useDeviceSession();
      captured.session = session;
      return <p>{session.activeOperation ?? "idle"}</p>;
    }
    const view = render(
      <DeviceSessionProvider controller={controller}>
        <Capture />
      </DeviceSessionProvider>,
    );

    const session = captured.session;
    if (!session) throw new Error("session not captured");
    let finishStream: () => void = () => {};
    const order: string[] = [];
    const stream = session.runOperation(
      "custom RGB",
      () =>
        new Promise<void>((resolve) => {
          finishStream = () => {
            order.push("stream");
            resolve();
          };
        }),
      { background: true },
    );
    expect(view.getByText("idle")).toBeTruthy();

    // A foreground action waits for the in-flight stream instead of failing.
    const foreground = session.runOperation("lighting", async () => {
      order.push("lighting");
    });
    finishStream();
    await Promise.all([stream, foreground]);
    expect(order).toEqual(["stream", "lighting"]);
  });

  test("asks before leaving the page while a write is in progress", async () => {
    const controller = new MockDeviceController();
    await controller.connect();
    let finish: () => void = () => {};
    const view = render(
      <DeviceSessionProvider controller={controller}>
        <SessionProbe firstWork={() => new Promise<void>((resolve) => (finish = resolve))} />
      </DeviceSessionProvider>,
    );

    const unload = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);
    fireEvent.click(view.getByRole("button", { name: "first" }));
    expect(unload()).toBe(true);
    finish();
    // Effect cleanups run after paint, so wait for the listener to be removed.
    await waitFor(() => expect(unload()).toBe(false));
  });
});
