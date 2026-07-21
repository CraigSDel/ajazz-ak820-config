# Engineering learnings

These notes capture durable findings from reverse engineering, implementation,
hardware testing, and interface design. Each subject has one canonical home:

| Document | Use it for |
|---|---|
| [Manual-derived device behavior](device-manual.md) | Published specifications, physical controls, connection modes, shortcuts, screen behavior, and hot-swap instructions |
| [Hardware and transport](hardware-and-transport.md) | HID interfaces, wired-mode constraints, report handling, ACKs, and timing |
| [Lighting](lighting.md) | Lighting and sleep packets, normalization, preview, and hardware limits |
| [Display images](display-images.md) | RGB565 conversion, resizing, GIF compositing, upload framing, and persistence |
| [UX and responsive layout](ux-and-responsive-layout.md) | Workspace hierarchy, virtual-keyboard geometry, responsive behavior, and accessibility |
| [Validation](validation.md) | Automated evidence, visual checks, hardware boundaries, and release checklist |

## Reading paths

- Checking expected hardware behavior or keyboard shortcuts: begin with [Manual-derived device behavior](device-manual.md).
- Changing USB or WebHID code: begin with [Hardware and transport](hardware-and-transport.md), then read the operation-specific document.
- Changing RGB effects or sleep behavior: read [Lighting](lighting.md).
- Changing image decoding, resizing, animation, or TFT upload: read [Display images](display-images.md).
- Changing navigation, controls, or CSS: read [UX and responsive layout](ux-and-responsive-layout.md).
- Preparing a release: use [Validation](validation.md) and the [manual test plan](../manual-test.md).

The protocol facts describe what the current evidence supports. Manual-derived
claims are identified separately and should not override physical-device or USB
capture evidence. Items requiring the physical keyboard are explicitly separated
from automated guarantees.
