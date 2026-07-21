import { useState } from "react";
import { type DeviceHealth, useDeviceSession } from "../device/DeviceSession";

export function ConnectPanel() {
  const { connected, health, lastResponseAt, activeOperation, connect, disconnect } =
    useDeviceSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      if (connected) {
        await disconnect();
      } else {
        await connect();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel device-card connection-card">
      <div className="card-heading">
        <span className="card-icon" aria-hidden="true">
          USB
        </span>
        <div>
          <p className="eyebrow">Hardware access</p>
          <h2>Connection</h2>
        </div>
      </div>
      <div className={`device-health health-${health}`} role="status" aria-live="polite">
        <span className="device-health-dot" aria-hidden="true" />
        <span>
          <strong>{healthLabel(health)}</strong>
          {health === "connected" && lastResponseAt && (
            <small>Last successful command {lastResponseAt.toLocaleTimeString()}</small>
          )}
        </span>
      </div>
      {!connected && (
        <p className="hint">
          Connect the keyboard via <strong>USB-C cable</strong> and set the mode switch to{" "}
          <strong>wired</strong>. The TFT configuration interface is not exposed over Bluetooth or
          the 2.4&nbsp;GHz dongle — time sync and image upload will not work in those modes.
        </p>
      )}
      <button
        type="button"
        className={
          connected ? "secondary-action full-width-action" : "primary-action full-width-action"
        }
        onClick={onClick}
        disabled={busy || activeOperation !== null}
      >
        {connected ? "Disconnect" : "Connect keyboard"}
      </button>
      {error && (
        <p className="inline-status is-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function healthLabel(health: DeviceHealth): string {
  switch (health) {
    case "disconnected":
      return "Not connected";
    case "connected":
      return "USB interfaces open";
  }
}
