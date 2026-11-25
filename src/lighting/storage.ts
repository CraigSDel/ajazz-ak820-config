import { buildLightingDataPacket, type LightingConfig, LightingMode } from "../protocol/lighting";
import { buildLightingSleepPackets, type LightingSleepTime } from "../protocol/lighting-sleep";

/**
 * The keyboard can't report its current lighting, so the best the UI can do
 * is remember what this browser last sent successfully. Values are validated
 * with the protocol builders before use, so stale or edited storage can never
 * produce an invalid report.
 */
const STORAGE_KEY = "ak820-pro-last-sent-lighting-v1";

export type SentLightingState = {
  config?: LightingConfig;
  sleepTime?: LightingSleepTime;
};

export function loadSentLighting(): SentLightingState {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (!stored || typeof stored !== "object") return {};
    const { config, sleepTime } = stored as Record<string, unknown>;
    return {
      config: validConfig(config),
      sleepTime: validSleepTime(sleepTime),
    };
  } catch {
    return {};
  }
}

export function rememberSentLighting(change: SentLightingState): void {
  try {
    const next = { ...loadSentLighting(), ...change };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Remembering is best-effort; storage may be unavailable or full.
  }
}

function validConfig(value: unknown): LightingConfig | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as LightingConfig;
  if (typeof candidate.rainbow !== "boolean" || !candidate.color) return undefined;
  const config: LightingConfig = {
    mode: candidate.mode,
    color: {
      red: candidate.color.red,
      green: candidate.color.green,
      blue: candidate.color.blue,
    },
    rainbow: candidate.rainbow,
    brightness: candidate.brightness,
    speed: candidate.speed,
    direction: candidate.direction,
  };
  try {
    buildLightingDataPacket(config);
  } catch {
    return undefined;
  }
  // The UI only offers levels 1–5; Off is the one mode that stores 0.
  if (config.mode !== LightingMode.Off && (config.brightness < 1 || config.speed < 1)) {
    return undefined;
  }
  return config;
}

function validSleepTime(value: unknown): LightingSleepTime | undefined {
  try {
    buildLightingSleepPackets(value as LightingSleepTime);
    return value as LightingSleepTime;
  } catch {
    return undefined;
  }
}
