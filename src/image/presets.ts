import auroraUrl from "../../images/aurora.webp?url";
import javaDukeUrl from "../../images/java_duke.webp?url";
import orbitUrl from "../../images/orbit.webp?url";
import sunsetUrl from "../../images/sunset.webp?url";

// Sunset, Orbit and Aurora are original artwork generated at the panel's
// native 128 × 128 by scripts/generate-presets.mjs. Duke is the Java mascot,
// released by Sun Microsystems under the BSD license.

export type ImagePreset = {
  name: string;
  fileName: string;
  url: string;
};

export const IMAGE_PRESETS: readonly ImagePreset[] = [
  { name: "Sunset", fileName: "sunset.webp", url: sunsetUrl },
  { name: "Java Duke", fileName: "java_duke.webp", url: javaDukeUrl },
  { name: "Orbit", fileName: "orbit.webp", url: orbitUrl },
  { name: "Aurora", fileName: "aurora.webp", url: auroraUrl },
];
