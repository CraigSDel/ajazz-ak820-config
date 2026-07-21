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
FINISH, but not MODE_DATA. Hardware A/B testing showed that a WebHID read after
MODE_DATA made modes 4–6 go dark and left modes 16–17 on the previous effect.
Preset brightness and speed are levels 1–5. The frontend selection `Off` is
transmitted with report ID 2 and both levels 0; frontend effect 1 is transmitted
with report ID 7 and speed 0. These are wire encodings, not claims that those
report IDs have the catalogue meanings previously assigned to them.

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
colour, direction, brightness, and speed, but it does not publish a per-ID name
mapping. AJAZZ product material likewise confirms dynamic/customizable effects
without mapping names to IDs. Consequently, the current names below are a
provisional supplementary catalogue interpretation. Physical observations on
USB `0x0c45:0x8009` remain authoritative.

| Protocol selection | Provisional frontend interpretation |
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

Effects 2, 3, and 13–15 are provisionally reactive. Effects 6 and 8 are
provisionally fixed-palette. Direction controls appear only where presentation
metadata indicates support. Incorrect physical observations should update this
table and `src/lighting/effects.ts`, never the numeric protocol constants.

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

The virtual keyboard is an approximate rendering selected by each effect's
presentation metadata; it is not a protocol simulation. The Testing workspace stores
manual observations locally, applies the next untested effect automatically,
and exports a text report. Changing the preset transport increments the storage
version so results from incompatible implementations are not mixed.

## Lessons retained

- A successful HID acknowledgement does not prove visible lighting.
- Do not read after MODE_DATA in WebHID; hidapi reference behavior did not
  transfer safely to the browser transport.
- Keep preset and experimental custom-RGB transports separate.
- Do not expose level 6 for presets; the hardware feature packet supports 0–5.
- Keep protocol identity neutral; human names and previews are firmware-specific
  observations rather than packet semantics.
- Serialize every operation that shares a HID endpoint.

## Remaining hardware checks

- Record the visible behavior of all 19 working effect IDs and replace every
  provisional name, preview, and capability that differs on this firmware.
- Confirm Up/Down direction and mode 19's visible behavior.
- Confirm persistence across reconnect and power cycle.
- Confirm sleep timing and wake behavior.
- Validate per-key mapping and restore on `0x8009`, including ANSI/ISO differences.

See the [manual test plan](../manual-test.md) for the short procedure.
