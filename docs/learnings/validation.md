# Validation

[Learning index](README.md)

## Automated checks

Current baseline:

- `npm test`: 26 files, 159 tests
- `npm run test:coverage`: whole-source V8 coverage with enforced minimums of
  70% statements, 60% branches, 70% functions, and 70% lines
- `npm run build`: TypeScript and Vite production build
- `npm run lint`: Biome checks for `src/`

Tests lock packet bytes, ordering, acknowledgement rules, operation locking,
error handling, and UI behavior. Preset tests specifically require four feature
reports and prove that the optional command interface is not used.

Coverage includes application TypeScript and TSX, including the WebHID hardware
adapter. Only test files, test setup, and the thin browser entry point are
excluded. CI prints the totals in the job summary and retains the navigable HTML
report as an artifact for 14 days. Keep thresholds below the measured baseline
so small rounding changes do not cause noise, but raise them when sustained test
improvements create enough headroom.

## Physical boundary

Automated checks cannot prove that LEDs display the intended effect, that TFT
uploads persist, or that a firmware revision accepts a packet. Physical results
from the wired `0x0c45:0x8009` AK820 Pro take precedence over generic metadata.

### 2026-07-27 preset sweep

The corrected raw-mode transaction with mode-scoped MODE_DATA handshakes passed
effects 1–19. The four effects that previously retained the prior state—Breath
(7), Outward (9), Rolling (11), and Explode (13)—all worked after adding their
scoped handshake. Reapplication was also recorded for modes 4, 8, and 13
without regression. Off was reapplied once but left ungraded, so the sweep is
19 passed and 1 untested, not a complete 20-effect pass.

Before release:

- Pass the four preset canaries three times.
- Record Off and repeat any preset affected by later transport changes. Effects
  1–19 have a passing baseline for the current transaction.
- Confirm direction, persistence, sleep, time sync, and TFT uploads.
- Run per-key tests in wired mode, starting with one key and a manually
  restorable built-in effect.

See the [manual test plan](../manual-test.md).
