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
- AK820 Pro-specific four-report preset transaction with Off/Steady
  normalization and byte-level tests.
- Lighting sleep timeout.
- Approximate interactive keyboard preview.
- Optional static per-key RGB editor with read, paint, fill, clear, apply, and
  session restore.
- Dedicated hardware Testing workspace with persistent results and report
  export. Set `VITE_SHOW_HARDWARE_TESTING=false` to hide it.
- Responsive and keyboard-accessible UI.

## Hardware validation still required

- Re-run all 20 presets using the corrected feature-report transport.
- Confirm Up/Down direction, persistence, sleep timing, and wake behavior.
- Verify static and animated TFT persistence on the target keyboard.
- Verify per-key RGB mapping and restore on ANSI and ISO layouts.
- Confirm custom RGB persistence and safe write frequency.

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
