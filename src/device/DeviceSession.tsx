import { type ComponentChildren, createContext } from "preact";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { DeviceFailure } from "./errors";
import type { DeviceController, DeviceTransport } from "./types";

export type DeviceOperationName =
  | "time sync"
  | "image upload"
  | "lighting"
  | "lighting sleep"
  | "custom RGB";
type ActiveOperation = {
  id: number;
  generation: number;
  name: DeviceOperationName;
  background: boolean;
  settled: Promise<void>;
};

export type RunOperationOptions = {
  /**
   * Hold the device lock without publishing `activeOperation`. Used by
   * high-frequency streams (live per-key RGB) so each ~100 ms transfer
   * doesn't re-render every consumer of the session.
   */
  background?: boolean;
};

export type DeviceSessionValue = {
  controller: DeviceController;
  connected: boolean;
  lastResponseAt: Date | null;
  activeOperation: DeviceOperationName | null;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  runOperation<T>(
    name: DeviceOperationName,
    work: (transport: DeviceTransport) => Promise<T>,
    options?: RunOperationOptions,
  ): Promise<T>;
};

/** `lastResponseAt` is informational; don't refresh it more often than this. */
const RESPONSE_TIMESTAMP_INTERVAL_MS = 1000;

/** Operations that leave the keyboard half-written if the page closes mid-way. */
const UNLOAD_GUARDED_OPERATIONS: ReadonlySet<DeviceOperationName> = new Set([
  "image upload",
  "lighting",
  "lighting sleep",
  "time sync",
]);

const DeviceSessionContext = createContext<DeviceSessionValue | null>(null);

export function DeviceSessionProvider({
  controller,
  children,
}: {
  controller: DeviceController;
  children: ComponentChildren;
}) {
  const [connected, setConnected] = useState(controller.isConnected());
  const [lastResponseAt, setLastResponseAt] = useState<Date | null>(null);
  const [activeOperation, setActiveOperation] = useState<DeviceOperationName | null>(null);
  const activeRef = useRef<ActiveOperation | null>(null);
  const nextOperationId = useRef(0);
  const generation = useRef(0);

  const clearForDisconnect = useCallback(() => {
    generation.current += 1;
    activeRef.current = null;
    setActiveOperation(null);
    setConnected(false);
    setLastResponseAt(null);
  }, []);

  useEffect(() => controller.onDisconnect(clearForDisconnect), [controller, clearForDisconnect]);

  useEffect(() => {
    if (!activeOperation || !UNLOAD_GUARDED_OPERATIONS.has(activeOperation)) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy browsers require returnValue to be set to show the prompt.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [activeOperation]);

  const connect = useCallback(async () => {
    await controller.connect();
    setConnected(controller.isConnected());
  }, [controller]);

  const disconnect = useCallback(async () => {
    await controller.disconnect();
    clearForDisconnect();
  }, [controller, clearForDisconnect]);

  const runOperation = useCallback(
    async <T,>(
      name: DeviceOperationName,
      work: (transport: DeviceTransport) => Promise<T>,
      { background = false }: RunOperationOptions = {},
    ): Promise<T> => {
      if (!controller.isConnected()) {
        throw new DeviceFailure({ kind: "device-disconnected" });
      }
      // A background stream's transfer is short and its loop stops as soon as
      // the user leaves it, so let a foreground action wait for it to finish
      // instead of failing with "operation in progress".
      while (!background && activeRef.current?.background) {
        await activeRef.current.settled;
      }
      if (activeRef.current) {
        throw new DeviceFailure({
          kind: "operation-in-progress",
          operation: activeRef.current.name,
        });
      }

      let settle: () => void = () => {};
      const token: ActiveOperation = {
        id: ++nextOperationId.current,
        generation: generation.current,
        name,
        background,
        settled: new Promise<void>((resolve) => {
          settle = resolve;
        }),
      };
      activeRef.current = token;
      if (!background) setActiveOperation(name);
      const assertActive = () => {
        if (
          token.generation !== generation.current ||
          activeRef.current?.id !== token.id ||
          !controller.isConnected()
        ) {
          throw new DeviceFailure({ kind: "device-disconnected" });
        }
      };
      // Every call re-checks that this operation still owns a live device,
      // so work from a superseded or disconnected session fails fast.
      const guarded =
        <A extends unknown[], R>(call: (...args: A) => R) =>
        (...args: A): R => {
          assertActive();
          return call(...args);
        };
      const operationController: DeviceTransport = {
        sendFeatureReport: guarded((packet) => controller.sendFeatureReport(packet)),
        sendReport: guarded((chunk) => controller.sendReport(chunk)),
        receiveFeatureReport: guarded(() => controller.receiveFeatureReport()),
        waitForDataInputReport: guarded((ms) => controller.waitForDataInputReport(ms)),
        clearPendingDataInputReports: guarded(() => controller.clearPendingDataInputReports()),
      };

      try {
        if (!controller.isConnected()) {
          throw new DeviceFailure({ kind: "device-disconnected" });
        }
        const result = await work(operationController);
        assertActive();
        setLastResponseAt((previous) => {
          const now = new Date();
          return previous && now.getTime() - previous.getTime() < RESPONSE_TIMESTAMP_INTERVAL_MS
            ? previous
            : now;
        });
        return result;
      } finally {
        if (
          activeRef.current?.id === token.id &&
          activeRef.current.generation === token.generation
        ) {
          activeRef.current = null;
          if (!background) setActiveOperation(null);
        }
        settle();
      }
    },
    [controller],
  );

  const value = useMemo<DeviceSessionValue>(
    () => ({
      controller,
      connected,
      lastResponseAt,
      activeOperation,
      connect,
      disconnect,
      runOperation,
    }),
    [controller, connected, lastResponseAt, activeOperation, connect, disconnect, runOperation],
  );

  return <DeviceSessionContext.Provider value={value}>{children}</DeviceSessionContext.Provider>;
}

export function useDeviceSession(): DeviceSessionValue {
  const session = useContext(DeviceSessionContext);
  if (!session) throw new Error("useDeviceSession must be used within DeviceSessionProvider");
  return session;
}
