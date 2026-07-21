import { useMemo, useState } from "react";
import { DeviceSessionProvider, useDeviceSession } from "./device/DeviceSession";
import { UnsupportedBrowser } from "./ui/UnsupportedBrowser";
import { ConnectPanel } from "./ui/ConnectPanel";
import { TimeSyncPanel } from "./ui/TimeSyncPanel";
import { ImagePanel } from "./ui/ImagePanel";
import { LightingPanel } from "./ui/LightingPanel";
import { OperationStatus } from "./ui/OperationStatus";
import { WebHIDDeviceController } from "./device/webhid-controller";
import { EffectTestingPanel } from "./ui/EffectTestingPanel";

export default function App() {
  const supported = useMemo(() => typeof navigator !== "undefined" && "hid" in navigator, []);
  const [controller] = useState(() => new WebHIDDeviceController());

  if (!supported) return <UnsupportedBrowser />;

  return (
    <DeviceSessionProvider controller={controller}>
      <Configurator />
    </DeviceSessionProvider>
  );
}

type Workspace = "lighting" | "display" | "testing" | "device";

const BASE_WORKSPACES: { id: Workspace; label: string; description: string }[] = [
  { id: "lighting", label: "Lighting", description: "Effects, colour and sleep" },
  { id: "display", label: "Display", description: "TFT image upload" },
  { id: "testing", label: "Testing", description: "Hardware effect validation" },
  { id: "device", label: "Device", description: "Connection and time" },
];

const DEFAULT_SHOW_TESTING = import.meta.env.VITE_SHOW_HARDWARE_TESTING !== "false";

export function Configurator({ showTesting = DEFAULT_SHOW_TESTING }: { showTesting?: boolean }) {
  const [workspace, setWorkspace] = useState<Workspace>("lighting");
  const { health } = useDeviceSession();
  const workspaces = showTesting
    ? BASE_WORKSPACES
    : BASE_WORKSPACES.filter((item) => item.id !== "testing");
  const current = workspaces.find((item) => item.id === workspace) ?? workspaces[0];

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <div>
            <p className="eyebrow">Keyboard control</p>
            <h1>AJAZZ AK820 Pro</h1>
          </div>
        </div>
        <button
          type="button"
          className={`connection-pill health-${health}`}
          onClick={() => setWorkspace("device")}
          aria-label={`${healthText(health)}. Open device settings.`}
        >
          <span className="device-health-dot" aria-hidden="true" />
          {healthText(health)}
        </button>
      </header>

      <OperationStatus />

      <div className="app-shell">
        <nav className="workspace-nav" aria-label="Configurator sections">
          {workspaces.map((item) => (
            <button
              type="button"
              key={item.id}
              className={workspace === item.id ? "is-active" : ""}
              aria-label={`${item.label}: ${item.description}`}
              aria-current={workspace === item.id ? "page" : undefined}
              onClick={() => setWorkspace(item.id)}
            >
              <WorkspaceIcon workspace={item.id} />
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </nav>

        <main className="workspace">
          <div className="workspace-heading">
            <div>
              <p className="eyebrow">Configurator</p>
              <h2>{current.label}</h2>
            </div>
            <p>{current.description}</p>
          </div>

          {workspace === "lighting" && <LightingPanel />}
          {workspace === "display" && <ImagePanel />}
          {workspace === "testing" && showTesting && <EffectTestingPanel />}
          {workspace === "device" && (
            <div className="device-workspace">
              <ConnectPanel />
              <TimeSyncPanel />
            </div>
          )}
        </main>
      </div>

      <aside className="risk-notice" aria-label="Important safety notice">
        <span className="notice-icon" aria-hidden="true">
          !
        </span>
        <p>
          <strong>Community hardware tool — use at your own risk</strong>
          <span>
            Sends reverse-engineered commands directly to your keyboard. Keep the official driver
            available and do not disconnect during an operation.
          </span>
        </p>
      </aside>
    </div>
  );
}

function WorkspaceIcon({ workspace }: { workspace: Workspace }) {
  return (
    <svg className="workspace-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      {workspace === "lighting" && (
        <path d="M9 18h6M10 22h4M8.2 14.7A6 6 0 1 1 15.8 14.7C14.7 15.5 14 16.4 14 18h-4c0-1.6-.7-2.5-1.8-3.3Z" />
      )}
      {workspace === "display" && (
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 15.5v-10ZM9 21h6M12 17v4" />
      )}
      {workspace === "testing" && (
        <path d="M9 3h6M10 3v3l-4.5 8.2A4 4 0 0 0 9 20h6a4 4 0 0 0 3.5-5.8L14 6V3M8 13h8" />
      )}
      {workspace === "device" && (
        <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
      )}
    </svg>
  );
}

function healthText(health: ReturnType<typeof useDeviceSession>["health"]): string {
  switch (health) {
    case "disconnected":
      return "Not connected";
    case "connected":
      return "Keyboard connected";
  }
}
