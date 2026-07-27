# Lighting and sleep

[Learning index](README.md)

## Supported hardware

Preset lighting targets the original wired AJAZZ AK820 Pro with the 128 × 128
TFT and USB identity `0x0c45:0x8009`. Other AK820 variants are not assumed to
share this protocol.

## Preset transaction

Every preset uses four 64-byte feature reports on the control interface:

1. START (`0x04 0x18`)
2. MODE_PREAMBLE (`0x04 0x13`)
3. MODE_DATA (the first byte is the requested mode)
4. FINISH (`0x04 0xf0`)

Send the complete four-report transaction twice with a short settling delay.
Physical testing showed that the firmware sometimes acknowledged the first
transaction without committing it; manually clicking Apply twice made the
effect work. The automatic repeat makes that workaround deterministic.

Perform a best-effort feature acknowledgement after START, MODE_PREAMBLE, and
FINISH. MODE_DATA needs a firmware-specific policy: the capture-derived hidapi
implementations acknowledge every mode packet, but WebHID hardware sweeps show
that doing so globally can prevent other effects from committing. A full wired
sweep found that modes 7, 9, 11, and 13 retained the previous effect without the
read; mode 4 was already acknowledged because its numeric ID matched the control
report ID. The WebHID path therefore acknowledges MODE_DATA only for modes 4, 7,
9, 11, and 13.

The corrected transaction was physically swept on 2026-07-27. Effects 1–19 all
worked. Modes 7, 9, 11, and 13, which had retained the previous effect without
their MODE_DATA read, passed with the scoped handshake. Modes 4, 8, and 13 were
also explicitly reapplied during the run and continued to work; mode 13 passed
after two reapplications. Off was reapplied once but was not assigned a visual
result, so it remains unverified rather than failed.

Preset brightness and speed are levels 1–5. The frontend selection `Off` is
transmitted with its raw report ID 0 and both levels 0. Effects 1–19 are also
transmitted with their raw selected report IDs. This matches the captured
AK820 Pro mode packet and the OEM lighting table; aliases to other animations
must not be substituted.

The optional `0xff67` command interface is not used for presets. Hardware tests
showed that its generic SET-effect command could acknowledge a write while most
AK820 Pro effects remained dark.

## Effect catalogue

The keyboard-facing identity and frontend interpretation are deliberately
separate:

- `LightingMode.Off` and `LightingMode.Effect1`–`Effect19` are stable protocol
  selections. They are the only identities allowed in packet-building code.
- `LightingEffect.displayName`, `description`, `preview`, and control
  capabilities are replaceable presentation metadata.
- A renamed or corrected animation must never change its `protocolId`.

The AK820 Pro manual confirms 20 cyclic lighting effects and controls for
colour, direction, brightness, and speed. The current OEM web-driver table
maps effects 1–19 to the same raw IDs and capabilities as the captured
implementations. Physical observations on USB `0x0c45:0x8009` remain
authoritative where sources disagree, notably direction encoding.

| Protocol selection | Provisional frontend interpretation |
|---|---|
| 0 | Off |
| 1 | Static |
| 2–3 | Single Key On / Single Key Off |
| 4–5 | Glittering / Falling |
| 6 | Fixed-palette Colourful |
| 7 | Breath |
| 8 | Fixed-palette Spectrum Cycle |
| 9–12 | Outward, Scrolling, Rolling, and Rotating |
| 13–15 | Key-reactive Explode, Launch, and Ripples |
| 16–19 | Flowing, Pulsating, Tilt, and Shuttle |
| 128 | Experimental static per-key RGB |

Effects 2, 3, and 13–15 are provisionally reactive. Effects 6 and 8 are
provisionally fixed-palette. Direction controls appear only where presentation
metadata indicates support. Incorrect physical observations should update this
table and `src/lighting/effects.ts`, never the numeric protocol constants.

## Experimental per-key RGB

Per-key RGB uses the AK820 Pro's normal 64-byte feature interface. OEM-driver
captures show `0x04 0x20` setup, eight table reports, and `0x04 0x02` commit.
The first six table reports contain the 81 records `[device key ID, red, green,
blue]`; the final two are zero padding. Device IDs follow the captured OEM
table rather than the editor's sparse preview IDs.

Only writing is implemented. Reading and automatic restore remain disabled
until equivalent AK820 Pro captures establish those transactions. The firmware
resumes its stored preset after a single table. The app uses a deadline-based
100 ms start-to-start refresh, leaving margin below the OEM driver's observed
approximately 130 ms retransmission cadence without adding transfer time to the
refresh period. Streaming stops when the user leaves the Per-key panel or
presses Stop.

## Sleep

Sleep uses START, SLEEP_PREAMBLE (`0x04 0x17 0x01`), then an unnumbered data
packet. Byte 8 selects Never (`0`), 1 minute (`1`), 5 minutes (`2`), or
30 minutes (`3`). Do not read a feature acknowledgement after the data packet.

## UI and validation

The Lighting workspace contains normal effect and per-key controls. Hardware
validation lives in the separate Testing workspace, which can be hidden with
`VITE_SHOW_HARDWARE_TESTING=false`.

The virtual keyboard is an approximate rendering selected by each effect's
presentation metadata; it is not a protocol simulation. The Testing workspace stores
manual observations locally, applies the next untested effect automatically,
can reapply the selected effect, and exports a text report. Reapplication counts
are persisted per effect and included in the report. Changing the preset
transport increments the storage version so results from incompatible
implementations are not mixed.

## Lessons retained

- A successful HID acknowledgement does not prove visible lighting.
- Use the hardware-verified, mode-scoped MODE_DATA acknowledgement set in
  WebHID; neither acknowledging every mode nor acknowledging none is reliable.
- Keep preset and experimental custom-RGB transports separate.
- Do not expose level 6 for presets; the hardware feature packet supports 0–5.
- Keep protocol identity neutral; human names and previews are firmware-specific
  observations rather than packet semantics.
- Serialize every operation that shares a HID endpoint.

## Remaining hardware checks

- Record a visual result for Off; effects 1–19 passed the corrected transaction
  sweep on 2026-07-27.
- Record detailed motion and palette observations where the approximate preview
  still needs confirmation.
- Confirm Up/Down direction and mode 19's visible behavior.
- Confirm persistence across reconnect and power cycle.
- Confirm sleep timing and wake behavior.
- Validate per-key mapping and restore on `0x8009`, including ANSI/ISO differences.

See the [manual test plan](../manual-test.md) for the short procedure.
