import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useDeviceSession } from "../device/DeviceSession";
import { syncTime } from "../operations";
import { errorMessage } from "./text";

const AUTO_SYNC_STORAGE_KEY = "ak820-pro-auto-time-sync";

function readAutoSyncPreference(): boolean {
  try {
    return localStorage.getItem(AUTO_SYNC_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function TimeSyncPanel() {
  const { connected, activeOperation, runOperation } = useDeviceSession();
  const [status, setStatus] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(readAutoSyncPreference);
  // Start from the current state so remounting this panel on an existing
  // connection does not count as a fresh connect.
  const wasConnected = useRef(connected);

  const sync = useCallback(
    async (automatic: boolean) => {
      setStatus(automatic ? "Syncing clock after connecting…" : "Syncing…");
      try {
        const now = new Date();
        await runOperation("time sync", (operationController) =>
          syncTime(operationController, now),
        );
        setStatus(`Clock set to ${now.toLocaleString()}`);
      } catch (error) {
        setStatus(errorMessage(error, "Sync failed"));
      }
    },
    [runOperation],
  );

  useEffect(() => {
    const justConnected = connected && !wasConnected.current;
    wasConnected.current = connected;
    if (justConnected && autoSync) void sync(true);
  }, [connected, autoSync, sync]);

  const changeAutoSync = (enabled: boolean) => {
    setAutoSync(enabled);
    try {
      localStorage.setItem(AUTO_SYNC_STORAGE_KEY, String(enabled));
    } catch {
      // Preference is best-effort; private browsing may block storage.
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
      <p className="card-copy">
        Set the keyboard display to this computer&apos;s current date and time.
      </p>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={autoSync}
          onChange={(event) => changeAutoSync(event.currentTarget.checked)}
        />
        Sync automatically when the keyboard connects
      </label>
      <button
        type="button"
        className="secondary-action full-width-action"
        onClick={() => void sync(false)}
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
