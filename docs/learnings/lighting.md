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

Perform a best-effort feature acknowledgement after every report, including
MODE_DATA. Both direct AK820 Pro reference implementations do this; read errors
remain non-fatal because WebHID exposes the unnumbered descriptor differently
from hidapi. Preset brightness and speed are levels 1–5. Off uses brightness
and speed 0, while Steady uses speed 0. Every effect is sent with its native
mode ID, including Off (`0`) and Steady (`1`).

The optional `0xff67` command interface is not used for presets. Hardware tests
showed that its generic SET-effect command could acknowledge a write while most
AK820 Pro effects remained dark.

## Effect catalogue

Names and capabilities use supplementary AJAZZ catalogue metadata, while the
numeric IDs and transaction come from AK820 Pro-specific implementations.
Physical testing remains the authority for visible behavior.

| Modes | Behavior |
|---|---|
| 0 | Off |
| 1 | Steady |
| 2–3 | Key-reactive light/fade |
| 4–5 | Twinkle and snow |
| 6 | Fixed-palette Color Bloom |
| 7 | Breathing |
| 8 | Fixed-palette Spectrum Cycle |
| 9–12 | Fountain and wave effects |
| 13–15 | Key-reactive burst/trail/ripple |
| 16–19 | Flow, layered wave, rain, and shuttle |
| 128 | Experimental static per-key RGB |

Modes 2, 3, and 13–15 need physical key presses. Modes 6 and 8 choose their own
colors. Direction controls appear only where metadata indicates support.

## Experimental per-key RGB

Per-key RGB uses the optional `0xff67` interface:

- GET effect `0x13`, GET table `0x14`
- SET effect `0x23`, SET table `0x24`
- custom mode `0x80`
- 128 records of `[LED ID, red, green, blue]`

This protocol came from an AJAZZ web application that does not claim AK820 Pro
support. It is therefore capability-detected, isolated from presets, and still
requires physical validation. Reads and writes are serialized because
interleaving responses corrupts the command stream.

The editor intentionally provides only paint, fill, clear, brightness, apply,
and session restore. It performs no background or rapid repeated writes.

## Sleep

Sleep uses START, SLEEP_PREAMBLE (`0x04 0x17 0x01`), then an unnumbered data
packet. Byte 8 selects Never (`0`), 1 minute (`1`), 5 minutes (`2`), or
30 minutes (`3`). Do not read a feature acknowledgement after the data packet.

## UI and validation

The Lighting workspace contains normal effect and per-key controls. Hardware
validation lives in the separate Testing workspace, which can be hidden with
`VITE_SHOW_HARDWARE_TESTING=false`.

The virtual keyboard is an approximate preview. The Testing workspace stores
manual observations locally, applies the next untested effect automatically,
and exports a text report. Changing the preset transport increments the storage
version so results from incompatible implementations are not mixed.

## Lessons retained

- A successful HID acknowledgement does not prove visible lighting.
- Match the reference transaction with a best-effort read after MODE_DATA; do
  not add unrelated background connection heartbeats.
- Keep preset and experimental custom-RGB transports separate.
- Do not expose level 6 for presets; the hardware feature packet supports 0–5.
- Label reactive and fixed-palette modes so they are not mistaken for failures.
- Serialize every operation that shares a HID endpoint.

## Remaining hardware checks

- Re-run all presets after restoring native mode IDs and the MODE_DATA
  acknowledgement. Record the visible behavior of every "Wrong effect" so the
  generic catalogue names can be corrected for this firmware.
- Confirm Up/Down direction and mode 19's visible behavior.
- Confirm persistence across reconnect and power cycle.
- Confirm sleep timing and wake behavior.
- Validate per-key mapping and restore on `0x8009`, including ANSI/ISO differences.

See the [manual test plan](../manual-test.md) for the short procedure.
