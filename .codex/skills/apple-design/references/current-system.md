# Current Apple design system research

Use this reference when a request mentions current Apple design, trends, Liquid Glass, macOS Tahoe, iOS 26, or a recent Apple redesign. Recheck first-party sources when recency matters; the observations below were accessed on 2026-08-08.

## Source ledger

| First-party source | Observed guidance | Reusable principle | Caveat for the web |
| --- | --- | --- | --- |
| [Human Interface Guidelines overview](https://developer.apple.com/design/human-interface-guidelines/) | The current system foregrounds hierarchy, harmony through concentric geometry, and consistency across windows and displays. | Evaluate the whole system, not isolated components. | Browser controls and materials do not inherit Apple platform behavior automatically. |
| [Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles) | Apple reintroduced eight principles in June 2026: purpose, agency, responsibility, familiarity, flexibility, simplicity, craft, and delight. | Use principles to resolve tradeoffs; delight follows usefulness and craft. | Do not turn the principles into a visual checklist. |
| [Get to know the new design system — WWDC25](https://developer.apple.com/videos/play/wwdc2025/356/) | Apple emphasizes bolder left-aligned typography, three shape families, concentricity, a distinct functional layer, grouped toolbars, inset sidebars, and continuity across form factors. Compact macOS controls remain rounded rectangles; capsules emphasize larger actions. | Match density and shapes to platform context; use layout and grouping before decoration. | A responsive website must recreate the relationships semantically rather than copy native chrome. |
| [Meet Liquid Glass — WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/) | Liquid Glass is adaptive and dynamic. Apple reserves it for navigation and controls, warns against glass in content and glass-on-glass, and uses tint selectively for primary actions. | Treat glass as a functional layer, not a general surface style. | `backdrop-filter` reproduces blur, not lensing, environment-aware contrast, or native vibrancy. |
| [Materials](https://developer.apple.com/design/human-interface-guidelines/materials) | Liquid Glass and standard materials have different jobs. Standard materials structure the content layer; clear glass is limited to media-rich backgrounds with adequate dimming and bold foreground content. | Use standard/solid content surfaces and reserve clear glass for rare media cases. | Prefer reliable contrast over simulated optical complexity. |
| [Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/) | Mac apps support longer, deeper tasks, large and resizable canvases, precision input, keyboard workflows, and comfortable information density. | A Mac-like utility should be compact and capable, not an enlarged mobile UI. | Add browser equivalents for shortcuts, focus, resizing, and pointer states. |
| [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars) and [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) | Sidebars expose peer destinations and may be hideable; toolbars contain view title, navigation, and frequently used commands grouped by role and frequency. | Separate navigation from contextual actions and collapse only when space demands it. | Use semantic `nav`, headings, and buttons; preserve keyboard and screen-reader structure. |
| [Settings](https://developer.apple.com/design/human-interface-guidelines/settings), [Toggles](https://developer.apple.com/design/human-interface-guidelines/toggles), and [Pop-up buttons](https://developer.apple.com/design/human-interface-guidelines/pop-up-buttons) | Settings are grouped by stable panes; dense macOS forms use compact controls, with switches reserved for emphasized settings and pop-ups for mutually exclusive choices. | Prefer grouped rows and progressive disclosure over a grid of decorative cards. | Native HTML inputs need careful styling without removing semantics or operability. |
| [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Color](https://developer.apple.com/design/human-interface-guidelines/color), and [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode) | Type and semantic colours communicate hierarchy and adapt across appearance and contrast settings; dark mode uses base/elevated relationships rather than simple inversion. | Build semantic roles with independent light, dark, and contrast values. | Never hard-code a single palette and assume `filter: invert()` is equivalent. |
| [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) and [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) | Interfaces must support larger text, clear state beyond colour, comfortable controls, visible feedback, and reduced motion. | Accessibility states must be designed alongside default appearance. | Follow WCAG 2.2 AA and web input/focus conventions in addition to Apple guidance. |

## Durable principles versus current trends

Durable principles:

- Purpose and clear hierarchy precede visual style.
- Familiar controls, direct manipulation, immediate feedback, and user agency build trust.
- Platform context determines density, navigation, and control presentation.
- Typography, spacing, alignment, and semantic colour carry most of the interface.
- Motion explains spatial and causal relationships.
- Accessibility and adaptation are intrinsic, not alternate themes.

Current system expressions introduced or strongly emphasized in 2025–2026:

- Liquid Glass as a separate navigation/control layer above content
- Inset, floating sidebars and edge-to-edge content beneath navigation
- Concentric nested geometry based on parent radius and inset
- Bolder left-aligned typography at key moments
- More symbol-led bars, with text retained when symbols are ambiguous
- Morphing, source-anchored presentations and responsive glass feedback
- A shared component anatomy that changes presentation across iPhone, iPad, and Mac

Treat trends as optional expressions of the durable principles. A compact settings utility does not need an immersive media canvas simply because edge-to-edge content is current.

## The eight principles as decision questions

1. **Purpose:** What job deserves the user’s attention, and what can be removed?
2. **Agency:** Can people change course, undo mistakes, and understand consequences?
3. **Responsibility:** Does the design protect privacy, safety, time, and trust?
4. **Familiarity:** Do controls and spatial relationships behave as people expect?
5. **Flexibility:** Does the experience adapt to context, ability, input, language, and preference?
6. **Simplicity:** Is the common path clear without hiding essential context?
7. **Craft:** Are type, alignment, states, motion, performance, and edge cases deliberately resolved?
8. **Delight:** Does the whole experience create the intended feeling without ornamental distraction?

## Strong diagnostic signals

An attempted Apple-style interface is probably off when:

- every surface is blurred, translucent, rounded, or shadowed;
- the content itself looks like floating glass;
- a desktop utility uses landing-page typography and mobile-scale controls;
- card boundaries do the work that grouping and alignment should do;
- gradients and coloured glows sit behind glass solely to make the glass visible;
- all actions are blue or pill-shaped;
- mobile navigation is a squeezed sidebar, or desktop navigation is a stretched tab bar;
- motion decorates page load but does not explain origin, result, or state;
- light mode was inverted to create dark mode;
- the implementation is called finished without a rendered visual review.
