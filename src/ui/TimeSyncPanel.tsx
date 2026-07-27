import { useState } from "react";
import { useDeviceSession } from "../device/DeviceSession";
import { syncTime } from "../operations";

export function TimeSyncPanel() {
  const { connected, activeOperation, runOperation } = useDeviceSession();
  const [status, setStatus] = useState<string | null>(null);

  const onClick = async () => {
    setStatus("Syncing…");
    try {
      await runOperation("time sync", (operationController) =>
        syncTime(operationController, new Date()),
      );
      setStatus("Time synced");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Sync failed");
    }
  };

  return (
    <section className="panel device-card time-card">
      <div className="card-heading">
        <span className="card-icon is-clock" aria-hidden="true" />
        <div>
          <p className="eyebrow">On-device clock</p>
          <h2>Time sync</h2>
        </div>
      </div>
      <p className="card-copy">Set the keyboard display to your Mac's current date and time.</p>
      <button
        type="button"
        className="secondary-action full-width-action"
        onClick={onClick}
        disabled={!connected || activeOperation !== null}
      >
        Sync now
      </button>
      {status && (
        <p className="inline-status" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
