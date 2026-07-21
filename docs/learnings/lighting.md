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
palette flag, and supported direction. The current official online driver uses
the `0xff67` framed-command interface for built-in effects as well as a static
per-key color map. The app prefers command `0x23` for effects when that interface
is available and retains the legacy transaction only as a compatibility fallback.

- The official command interface uses brightness and speed levels 1 through 6.
- The legacy feature interface uses 0 through 5. The UI's level 6 is clamped to
  5 only when that compatibility path is required.
- On the command interface, Off is mode 0 and Static is mode 1. The legacy path
  transmits Off as SingleOn with zero levels and Static as Breath with speed 0.
- Direction is shown only for effects with known direction support.
- Reference sources disagree on numeric Up/Down mapping; physical confirmation
  remains required.

## Official effect metadata

The official catalogue exposes modes 1 through 19 plus custom mode 128. It
also declares whether each mode supports speed, a chosen color, and direction.
The UI uses this metadata instead of displaying every control for every mode.
Modes 10, 11, 12, 16, and 18 are directional; modes 6 and 8 use fixed palettes.
All color-capable modes, including Steady, can switch between one chosen color
and the keyboard's built-in RGB palette. Effect names are descriptive English
labels rather than ambiguous literal translations, while protocol IDs remain
unchanged.

| Mode | UI name | Color behavior | Motion behavior |
|---:|---|---|---|
| 0 | Off | None | Lighting disabled |
| 1 | Steady | Chosen color or RGB palette | No speed |
| 2 | Key Press — Light Up | Chosen color or RGB palette | Reactive; press a key |
| 3 | Key Press — Fade Out | Chosen color or RGB palette | Reactive; press a key |
| 4 | Twinkling Stars | Chosen color or RGB palette | Animated |
| 5 | Falling Snow | Chosen color or RGB palette | Animated |
| 6 | Color Bloom | Fixed palette; chosen color ignored | Animated |
| 7 | Breathing | Chosen color or RGB palette | Animated |
| 8 | Spectrum Cycle | Fixed palette; chosen color ignored | Animated |
| 9 | Color Fountain | Chosen color or RGB palette | Animated |
| 10 | Cross-Wave | Chosen color or RGB palette | Animated; up/down |
| 11 | Rolling Wave | Chosen color or RGB palette | Animated; left/right |
| 12 | Rotating Wave | Chosen color or RGB palette | Animated; left/right |
| 13 | Key Press — Burst | Chosen color or RGB palette | Reactive; press a key |
| 14 | Key Press — Dual Trail | Chosen color or RGB palette | Reactive; press a key |
| 15 | Key Press — Ripple | Chosen color or RGB palette | Reactive; press a key |
| 16 | Continuous Flow | Chosen color or RGB palette | Animated; left/right |
| 17 | Layered Wave | Chosen color or RGB palette | Animated |
| 18 | Diagonal Rain | Chosen color or RGB palette | Animated; left/right |
| 19 | Shuttle | Chosen color or RGB palette | Animated |
| 128 | Custom per-key | One RGB value per LED | Static only |

Modes 2, 3, and 13–15 can appear inactive until a physical key is pressed.
Modes 6 and 8 can appear to ignore configuration because their colors are
firmware-defined. The UI labels both cases rather than treating them as errors.

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

All `0xff67` exchanges are serialized. In particular, the 16-byte effect backup
must finish before the 512-byte custom table read starts; running both reads in
parallel interleaves requests and acknowledgements on older 820PRO firmware.
Each packet follows the official driver's initial attempt plus three retries.

The AK820/820PRO official configuration does not enable GIF lighting. Host-side
rapid writes are deliberately not used as a substitute because persistence and
write endurance have not been established.

### Reduction decision

The first custom editor mixed the protocol experiment with profiles, imports,
presets, gradients, group selection, recent colors, and undo history. Those
features multiplied browser state and tests without improving confidence in the
keyboard exchange. The reduced editor keeps only direct key painting,
fill/clear, brightness, read, apply, and restore. This makes every hardware
operation visible and leaves one color table as the only editable model.

Convenience features should return only after custom mode is physically verified
on both wired 820PRO product IDs. They should be isolated from transport code and
must not introduce background writes.

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
elements focusable paint controls. Keeping the same nodes
prevents changes in height, scroll position, focus geometry, and perceived
hardware identity when the mode changes.

Effect selection uses the same metadata as the protocol and preview, so its
visual tile, label, description, supported controls, and transmitted mode cannot
drift independently. The effect browser is presentation only: selecting an
option changes the browser preview, while the explicit Apply action remains the
only built-in-effect hardware write. Common color swatches update the same RGB
state as the full color input and do not introduce a second color model.

## What failed

- Treating MODE_DATA like a normal `0x04` control report and reading a feature
  response afterward can terminate the legacy update.
- Using the legacy mode-valued feature-report path through Chromium can produce
  a successful API call without changing the keyboard. Prefer command `0x23`.
- A framed SET response confirms transport, not retained state. Read effect
  command `0x13` back after the write; retry once inside the official driver's
  500 ms settling window, then report the requested and retained mode IDs.
- Treating official levels as legacy levels hid level 6 and exposed ineffective
  level 0. Keep transport-specific validation and clamp only at the fallback.
- Presenting reactive and fixed-palette effects like ordinary animations made
  supported effects appear broken. Capability metadata must drive both controls
  and explanatory UI.
- Parallel command reads can corrupt the acknowledgement stream used by both
  custom RGB and later built-in effects. Serialize the endpoint even when the
  higher-level operation lock already prevents separate UI operations.

## Remaining hardware checks

- Confirm Off and Static on both command and legacy transports.
- Confirm Up/Down direction.
- Confirm persistence across reconnect and power cycle.
- Confirm sleep timing and wake behavior.
- Validate custom mode and restore on both PIDs `0x8009` and `0x800a`.
- Verify the ISO LED map and capture any ANSI-layout differences.

The full checklist is in [Validation](validation.md#hardware-release-checklist).
