# Validation

[Learning index](README.md)

## Automated checks

Current baseline:

- `npm test`: 25 files, 154 tests
- `npm run build`: TypeScript and Vite production build
- `npm run lint`: Biome checks for `src/`

Tests lock packet bytes, ordering, acknowledgement rules, operation locking,
error handling, and UI behavior. Preset tests specifically require four feature
reports and prove that the optional command interface is not used.

## Physical boundary

Automated checks cannot prove that LEDs display the intended effect, that TFT
uploads persist, or that a firmware revision accepts a packet. Physical results
from the wired `0x0c45:0x8009` AK820 Pro take precedence over generic metadata.

Before release:

- Pass the four preset canaries three times.
- Record all 20 effects in the Testing workspace.
- Confirm direction, persistence, sleep, time sync, and TFT uploads.
- Run per-key tests only when the optional interface is detected.

See the [manual test plan](../manual-test.md).
