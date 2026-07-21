# Hardware and transport

[Learning index](README.md)

## Hardware overview

The AK820 Pro's 0.85-inch TFT is a 128 × 128 GC9107-driven panel attached to a
Sonix SN32F299 MCU. The browser reaches two vendor-specific HID interfaces:

The supported wired USB identity is `0x0c45:0x8009`. Nearby Sonix product IDs
are reused by other keyboards and must not be treated as AK820 Pro evidence.

- **Control interface:** usage page `0xFF13`, interface `3`; 64-byte feature
  reports select operations and carry metadata.
- **Data interface:** usage page `0xFF68`, interface `2`; 4096-byte output
  reports carry image payloads and produce an ACK input report per chunk.

Both vendor interfaces are available only in **wired USB-C mode**. Bluetooth
and the 2.4 GHz dongle are not substitutes for configuration operations.

## Evidence provenance

The image framing was triangulated from a USB capture of a Windows driver,
Ghidra analysis of that driver, and the
`aar-rafi/aks075-linux` implementation. The gohv project supplied useful
AK820-Pro-specific context but its alternate static-image framing does not persist
reliably. Operation-specific conclusions are recorded in
[Display images](display-images.md#failed-approaches).

## WebHID report convention

Reference implementations disagree on whether leading `0x04` is a HID report
ID or payload byte. Evidence from `aks075-linux` and the Windows-driver framing
shows the actual HID report ID is `0x00`; `0x04` is the first payload byte.

The controller therefore sends control feature reports as unnumbered reports
and sends data chunks with `reportId = 0`. WebHID dispatches the data as
interrupt OUT reports.

## Handshake rule

The direct AK820 Pro implementations perform a best-effort GET-feature
handshake after every feature write:

- Lighting START, MODE_PREAMBLE, MODE_DATA, and FINISH: read.
- Sleep START and SLEEP_PREAMBLE: read allowed.
- Unnumbered sleep data: no read.
- Image chunks: wait for the data-interface ACK input report instead.

WebHID requests the unnumbered report (`0`) for each handshake. Unsupported or
stalled reads are non-fatal, matching the reference implementations' error
handling.

## Timing

The current implementation uses:

- 50 ms between control feature reports.
- 300 ms ACK timeout for each image chunk.
- 100 ms after image SAVE before reporting success.

These values track the observed/reference ranges: `aks075-linux` waits roughly
40 ms between control reports, while gohv uses shorter inter-report waits and a
100 ms post-save delay.

## Evidence boundary

Automated tests can prove report bytes, ordering, interface selection, ACK
handling, and error propagation. They cannot prove that every firmware revision
accepts the sequence or that the LEDs and TFT show the intended result. See
[Validation](validation.md) for the required physical checks.

Related operation details:

- [Lighting](lighting.md)
- [Display images](display-images.md)
