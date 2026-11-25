import { describe, expect, test } from "vitest";
import { LightingMode } from "../../protocol/lighting";
import { LightingSleepTime } from "../../protocol/lighting-sleep";
import { DEFAULT_LIGHTING_CONFIG } from "../default-config";
import { loadSentLighting, rememberSentLighting } from "../storage";

describe("last-sent lighting storage", () => {
  test("round-trips a sent configuration and sleep time independently", () => {
    const config = {
      ...DEFAULT_LIGHTING_CONFIG,
      mode: LightingMode.Breath,
      brightness: 2 as const,
    };
    rememberSentLighting({ config });
    rememberSentLighting({ sleepTime: LightingSleepTime.FiveMinutes });
    expect(loadSentLighting()).toEqual({ config, sleepTime: LightingSleepTime.FiveMinutes });
  });

  test("ignores corrupt or out-of-range values instead of sending them", () => {
    localStorage.setItem(
      "ak820-pro-last-sent-lighting-v1",
      JSON.stringify({
        config: { ...DEFAULT_LIGHTING_CONFIG, brightness: 9 },
        sleepTime: 42,
      }),
    );
    expect(loadSentLighting()).toEqual({ config: undefined, sleepTime: undefined });

    localStorage.setItem("ak820-pro-last-sent-lighting-v1", "{not json");
    expect(loadSentLighting()).toEqual({});
  });
});
