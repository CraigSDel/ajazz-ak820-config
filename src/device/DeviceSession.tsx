import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DeviceFailure } from "./errors";
import type { DeviceController } from "./types";

export type DeviceOperationName =
  | "time sync"
  | "image upload"
  | "lighting"
  | "lighting sleep"
  | "custom RGB";
export type DeviceHealth = "disconnected" | "connected";

type ActiveOperation = { id: number; generation: number; name: DeviceOperationName };

export type DeviceSessionValue = {
  controller: DeviceController;
  connected: boolean;
  health: DeviceHealth;
  lastResponseAt: Date | null;
  activeOperation: DeviceOperationName | null;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  runOperation<T>(name: DeviceOperationName, work: () => Promise<T>): Promise<T>;
};

const DeviceSessionContext = createContext<DeviceSessionValue | null>(null);

export function DeviceSessionProvider({
  controller,
  children,
}: {
  controller: DeviceController;
  children: ReactNode;
}) {
  const [connected, setConnected] = useState(controller.isConnected());
  const [health, setHealth] = useState<DeviceHealth>(
    controller.isConnected() ? "connected" : "disconnected",
  );
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
    setHealth("disconnected");
    setLastResponseAt(null);
  }, []);

  useEffect(() => controller.onDisconnect(clearForDisconnect), [controller, clearForDisconnect]);

  const connect = useCallback(async () => {
    await controller.connect();
    setConnected(controller.isConnected());
    setHealth(controller.isConnected() ? "connected" : "disconnected");
  }, [controller]);

  const disconnect = useCallback(async () => {
    await controller.disconnect();
    clearForDisconnect();
  }, [controller, clearForDisconnect]);

  const runOperation = useCallback(
    async <T,>(name: DeviceOperationName, work: () => Promise<T>): Promise<T> => {
      if (!controller.isConnected()) {
        throw new DeviceFailure({ kind: "device-disconnected" });
      }
      if (activeRef.current) {
        throw new DeviceFailure({
          kind: "operation-in-progress",
          operation: activeRef.current.name,
        });
      }

      const token: ActiveOperation = {
        id: ++nextOperationId.current,
        generation: generation.current,
        name,
      };
      activeRef.current = token;
      setActiveOperation(name);

      try {
        if (!controller.isConnected()) {
          throw new DeviceFailure({ kind: "device-disconnected" });
        }
        const result = await work();
        setHealth("connected");
        setLastResponseAt(new Date());
        return result;
      } finally {
        if (
          activeRef.current?.id === token.id &&
          activeRef.current.generation === token.generation
        ) {
          activeRef.current = null;
          setActiveOperation(null);
        }
      }
    },
    [controller],
  );

  const value = useMemo<DeviceSessionValue>(
    () => ({
      controller,
      connected,
      health,
      lastResponseAt,
      activeOperation,
      connect,
      disconnect,
      runOperation,
    }),
    [
      controller,
      connected,
      health,
      lastResponseAt,
      activeOperation,
      connect,
      disconnect,
      runOperation,
    ],
  );

  return <DeviceSessionContext.Provider value={value}>{children}</DeviceSessionContext.Provider>;
}

export function useDeviceSession(): DeviceSessionValue {
  const session = useContext(DeviceSessionContext);
  if (!session) throw new Error("useDeviceSession must be used within DeviceSessionProvider");
  return session;
}
