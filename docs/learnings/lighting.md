# Lighting and sleep

[Learning index](README.md)

## Lighting transaction

A complete lighting update uses four 64-byte feature reports on the control
interface:

1. START (`0x04 0x18`)
2. MODE_PREAMBLE (`0x04 0x13`)
3. MODE_DATA, whose first byte is the effective effect number
4. FINISH (`0x04 0xF0`)

GET-feature handshakes occur after the three `0x04` control reports only. There
must be no read after MODE_DATA. The rationale and transport rule live in
[Hardware and transport](hardware-and-transport.md#handshake-rule).

## Configuration semantics

The legacy packet controls a whole-keyboard effect, color, brightness, speed,
palette flag, and supported direction. The current official online driver also
documents a separate framed-command path for a static per-key color map. The
app keeps these transports separate and exposes custom editing only when the
additional `0xff67` HID interface is present.

- Brightness and speed are levels 0 through 5.
- Off is transmitted as SingleOn with brightness and speed zero.
- Static is transmitted as Breath with speed zero.
- Direction is shown only for effects with known direction support.
- Reference sources disagree on numeric Up/Down mapping; physical confirmation
  remains required.

## Official effect metadata

The official catalogue exposes modes 1 through 19 plus custom mode 128. It
also declares whether each mode supports speed, a chosen color, and direction.
The UI uses this metadata instead of displaying every control for every mode.
Modes 10, 11, 12, 16, and 18 are directional; modes 6 and 8 use fixed palettes.
Effect names are descriptive English labels rather than ambiguous literal
translations, while protocol IDs remain unchanged.

## Static per-key custom RGB

The official command implementation uses:

- usage page `0xff67`;
- request header `0xAA`, response header `0x55`;
- GET effect `0x13`, GET custom table `0x14`;
- SET effect `0x23`, SET custom table `0x24`;
- custom mode `0x80`;
- 128 entries of `[LED ID, red, green, blue]` (512 bytes total).

The editor reads both the current effect and custom table before applying. That
snapshot can be restored during the same page session. Writes occur only after
an explicit Apply action and risk acknowledgement; painting the browser preview
does not communicate with the keyboard.

The AK820/820PRO official configuration does not enable GIF lighting. Host-side
rapid writes are deliberately not used as a substitute because persistence and
write endurance have not been established.

## Sleep transaction

Sleep uses START, SLEEP_PREAMBLE (`0x04 0x17 0x01`), and an unnumbered data
packet. Byte 8 of the data packet is:

| Setting | Value |
|---|---|
| Never | `0` |
| 1 minute | `1` |
| 5 minutes | `2` |
| 30 minutes | `3` |

The unnumbered data packet must not receive a GET-feature handshake.

## Preview

One virtual keyboard switches between effect preview and per-key editing. It
uses the official ISO LED map in both modes so geometry stays stable. Effect
simulations identify themselves as approximate; reactive modes wait for a key
press and propagate from that origin. Per-key mode previews the exact static RGB
table that will be encoded.

The keyboard is a single persistent render tree. Built-in mode makes its keys
animation targets and reactive-preview triggers; per-key mode makes those same
elements focusable paint controls with selection state. Keeping the same nodes
prevents changes in height, scroll position, focus geometry, and perceived
hardware identity when the mode changes.

Effect selection uses the same metadata as the protocol and preview, so its
visual tile, label, description, supported controls, and transmitted mode cannot
drift independently. The effect browser is presentation only: selecting an
option changes the browser preview, while the explicit Apply action remains the
only built-in-effect hardware write. Common color swatches update the same RGB
state as the full color input and do not introduce a second color model.

## What failed

Treating MODE_DATA like a normal `0x04` control report and reading a feature
response afterward can terminate the update. The fix is report-aware
handshaking, not additional delay or retry logic.

## Remaining hardware checks

- Confirm Off and Static normalization on the LEDs.
- Confirm Up/Down direction.
- Confirm persistence across reconnect and power cycle.
- Confirm sleep timing and wake behavior.
- Validate custom mode and restore on both PIDs `0x8009` and `0x800a`.
- Verify the ISO LED map and capture any ANSI-layout differences.

The full checklist is in [Validation](validation.md#hardware-release-checklist).
