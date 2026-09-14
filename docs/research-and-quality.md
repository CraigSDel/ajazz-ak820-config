# Research and quality baseline

This document records the evidence behind the configurator's responsive UI and
RGB decisions. It is deliberately conservative: byte-level tests prove what the
app sends, while only a physical keyboard proves what a firmware revision does.

Last reviewed: 2026-09-14.

## Product and design objective

The configurator is a task-focused hardware utility. A user must be able to
connect a keyboard, inspect a spatial keyboard preview, change one setting, and
understand whether it was sent successfully. The interface should reflow at
320 CSS pixels without page-level horizontal scrolling. The keyboard itself is
the one justified two-dimensional region: at narrow widths it keeps legible keys
and scrolls inside its own labelled container instead of shrinking into an
unusable thumbnail.

### Evidence ledger

| Source | Observation | Decision in this project |
| --- | --- | --- |
| [WCAG 2.2: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | Content should remain usable at 320 CSS pixels; intrinsically two-dimensional interfaces may scroll within their own region. | Reflow every panel and isolate horizontal scrolling to the spatial keyboard canvas. |
| [WCAG 2.2: Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | Pointer targets should be at least 24 by 24 CSS pixels or have sufficient separation. | Mobile navigation and colour swatches exceed that minimum; the keyboard canvas preserves usable key geometry rather than scaling indefinitely. |
| [MDN: CSS container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries) | Components can respond to available container width instead of assuming a particular device. | Prefer intrinsic grids and content-pressure breakpoints. Container queries remain a future cleanup opportunity because the current stylesheet has route-level layout rules. |
| [ak820pro-modder protocol notes](https://github.com/wsclx/ak820pro-modder/blob/main/docs/PROTOCOL.md) | A firmware-1.07 investigation reports an official-driver output-report protocol with `SET_LED_EFFECT` `0x23` and `SET_CUSTOM_LED_DATA` `0x24`. | Track this as a second protocol family. Do not replace the feature-report path already verified on this project's target until the alternate path passes the hardware gate below. |

## Responsive contract

- At 320 CSS pixels, ordinary content reflows without page-level horizontal
  scrolling, clipping, or overlapping the bottom navigation.
- Below 621 CSS pixels, navigation becomes a sticky four-item bar with icons,
  text labels, and at least 44 CSS pixels of height. It occupies layout space
  and therefore cannot cover form controls or status messages.
- The keyboard preview keeps a 38rem internal canvas on narrow screens. Its own
  horizontal scrollbar and nearby instruction communicate that it can be panned.
- At 621–1024 CSS pixels, workspaces are single-column and controls retain their
  full labels.
- Above 1024 CSS pixels, the lighting preview and inspector may share a row.
- Browser zoom must preserve text enlargement. Do not counteract zoom by
  reducing root font size or scaling the entire application.
- Reduced-motion, reduced-transparency, increased-contrast, keyboard focus, and
  coarse-pointer modes must remain complete and usable.

## RGB protocol status

There are currently two incompatible bodies of evidence:

1. This repository's target keyboard accepted a four-feature-report lighting
   transaction on its control interface. Effects 1–19 were physically checked
   on 2026-07-27. The firmware sometimes required the complete transaction to be
   repeated before it committed.
2. A separate firmware-1.07/macOS investigation derived the official web-driver
   framing: 64-byte output reports beginning with `0xAA`, commands `0x23` for a
   16-byte effect payload and `0x24` for a 512-byte per-key table. It reports
   usage page `0xFF68` for control writes and persistent custom mode `0x80`.

These findings may describe different firmware, descriptors, operating-system
exposure, or product revisions. Treating one as universally correct could leave
keys dark or write to the wrong interface. The app therefore keeps its known
path and describes custom RGB as experimental and live-only.

### Gate for a persistent custom-RGB implementation

Before exposing the alternate protocol in the main UI:

1. Record the exact product label, VID/PID, firmware version, OS, browser, and
   every vendor usage page from `HIDDevice.collections`.
2. Capture an official-driver write for static red, a multicolour effect, and a
   two-key custom layout on that same keyboard.
3. Add pure builders and byte fixtures for the `0xAA` outer frame, the 16-byte
   effect payload, and chunked 512-byte custom payload.
4. Add transport support without changing the existing image-ACK queue.
5. Probe capability non-destructively and select a protocol by observed
   descriptor/response—not by OS or product name.
6. Apply, read back with `GET_LED_EFFECT`/`GET_CUSTOM_LED_DATA`, power-cycle, and
   verify visible state. On failure, leave the existing feature path available.
7. Verify all 20 modes, mono/multicolour variants, brightness 0–5, speed 0–5,
   four directions, ANSI key mapping, disconnect recovery, and rapid updates.

Until this gate passes, “perfect RGB support” is not an honest claim. The safe
goal is explicit capability detection, read-after-write verification, and a
tested fallback for each supported firmware family.

## Acceptance checklist

- Render Lighting, Display, Testing, and Device at widths 320, 360, 768, 1024,
  and 1440 CSS pixels.
- Confirm `document.documentElement.scrollWidth === window.innerWidth`; the
  keyboard preview is the only intended horizontal scroller.
- Confirm the fixed navigation does not cover the final focusable control or
  safety notice.
- At 200% and 400% zoom, confirm labels are not clipped and focus remains visible.
- Use keyboard-only navigation through tabs, selects, effect picker, and per-key
  editor; verify live status announcements.
- Run `npm run test:coverage`, `npm run lint`, and `npm run build`.
- Run the relevant steps in [manual-test.md](manual-test.md) on physical hardware
  before changing any feature-status claim from experimental to verified.
