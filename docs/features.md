# Feature status

The app targets the original wired AJAZZ AK820 Pro (`0x0c45:0x8009`) in a
Chromium browser. It remains local-only and communicates through WebHID.

## Implemented

- Device connection, disconnect recovery, and shared operation locking.
- TFT time synchronization.
- Static PNG, JPEG, and WebP upload with aspect-fit resizing.
- Animated GIF/WebP and ordered multi-image upload.
- Twenty preset lighting modes with color, palette, brightness, speed, and
  mode-aware direction controls.
- AK820 Pro-specific four-report preset transaction, repeated for reliable
  firmware commit, with raw OEM mode IDs and byte-level tests.
- Lighting sleep timeout.
- Approximate interactive keyboard preview.
- Experimental write-only live per-key RGB editor with paint, fill, clear,
  start, and stop.
- Dedicated hardware Testing workspace with persistent results and report
  export, including logged per-effect RGB reapplications. Set
  `VITE_SHOW_HARDWARE_TESTING=false` to hide it.
- Responsive and keyboard-accessible UI.

## Hardware validation still required

- Record Off. Effects 1–19 passed the corrected feature-report transaction on
  the wired target on 2026-07-27.
- Confirm Up/Down direction, persistence, sleep timing, and wake behavior.
- Verify static and animated TFT persistence on the target keyboard.
- Verify the captured per-key RGB mapping on the ANSI layout.
- Confirm custom RGB persistence and safe write frequency.

An independent firmware-1.07 investigation has documented a second, official-
driver-style output-report protocol for lighting and persistent per-key RGB.
It is not yet enabled here because it conflicts with the feature-report path
already verified on this project's target. See
[`research-and-quality.md`](research-and-quality.md#rgb-protocol-status) for the
evidence, compatibility risk, and hardware gate required before integration.

Use [`manual-test.md`](manual-test.md) for the procedure. Record protocol-level
findings in [`learnings/`](learnings/README.md), not in this status page.

## Deferred

### Key remapping

Do not implement until a reversible, one-key AK820 Pro capture proves the key
index, HID usage, layer, save command, and restoration sequence. ANSI and ISO
layouts require separate mapping evidence.

### Macros

Do not implement until captures establish slot IDs, press/release encoding,
delays, limits, assignment, persistence, and deletion. A safe restore path is
required before exposing writes.

## Delivery gate

Every change must pass tests, TypeScript/Vite build, lint, and the relevant
physical checks. Automated packet tests prove bytes and ordering, not visible
keyboard or TFT behavior.
