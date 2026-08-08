---
name: apple-design
description: Research, design, audit, and implement Apple-coherent interfaces for the web, including current Apple design-system trends, macOS and iOS/iPadOS platform adaptation, Liquid Glass and material hierarchy, layout and information architecture, typography, semantic colour, controls, sidebars and toolbars, concentric geometry, responsive behavior, accessibility, and fluid gesture-driven motion. Use when a user asks for an Apple-like, Apple-inspired, macOS-like, iOS-like, Liquid Glass, polished native-feeling, or spatially fluid UI; when an app “doesn't look Apple”; or when reviewing or correcting an attempted Apple-style redesign. Do not use merely to add blur, rounded cards, or spring animation without a broader Apple-design goal.
---

# Apple Design

Create interfaces that feel coherent, calm, direct, and native to their context. Treat “Apple-like” as a system of hierarchy, structure, geometry, typography, controls, feedback, and adaptation — not a visual-effects preset.

## Start with the product, not the aesthetic

Identify the product’s primary job, target input, and closest platform archetype before styling.

| Archetype | Default character | Avoid |
| --- | --- | --- |
| macOS utility, configurator, or inspector | Compact, information-dense, resizable, keyboard/pointer capable; sidebar or toolbar plus grouped settings | Marketing-scale headings, phone-sized controls everywhere, excessive capsules, card grids |
| macOS content or document app | Wide canvas, persistent navigation, contextual toolbars, minimal modality | Putting every action inside the content surface |
| iPhone task flow | Focused vertical sequence, reachable controls, progressive disclosure, 44px touch regions | Desktop sidebars squeezed into a narrow viewport |
| iPad adaptive workspace | Scalable split view, touch and pointer support, collapsible navigation | Treating iPad as merely a large phone |
| Media-rich immersive app | Content-led canvas with restrained floating controls | Glass panels competing with the media |

State the chosen archetype and the emotion the interface should create. Preserve the product’s own identity; do not reproduce Apple branding, proprietary assets, or distinctive trade dress.

## Apply the hierarchy model

Map every visible surface into one of these layers before editing CSS:

1. **Content layer:** the app’s actual information and work. Keep it visually quiet, readable, and mostly opaque or standard-material.
2. **Functional layer:** navigation and high-value controls that float above content. This is the proper home for restrained glass treatment.
3. **Transient layer:** menus, popovers, sheets, alerts, drag previews, and tooltips. Anchor each to its source and give modality only when the task interrupts the main flow.

Do not put Liquid Glass across the content layer. Do not stack glass on glass. If the browser cannot reproduce Apple’s adaptive lensing, tint, vibrancy, and environment-aware contrast, prefer a restrained translucent approximation with reliable legibility over decorative “glassmorphism.”

## Build hierarchy before decoration

Establish, in order:

1. Information architecture and the primary journey
2. Navigation model and persistent versus contextual actions
3. Content grouping, alignment, and density
4. Type hierarchy and semantic colour roles
5. Control choice, state, and placement
6. Shape, material, depth, and motion

Use proximity, alignment, whitespace, and a limited set of dividers to express grouping. Avoid “card soup”: nested rounded rectangles, repeated borders, and shadows around every subsection flatten hierarchy instead of strengthening it. A settings page generally needs grouped rows and sections, not a dashboard of promotional cards.

## Use current Apple geometry deliberately

Use three shape families:

- **Fixed-radius rounded rectangles** for compact desktop controls and dense settings.
- **Capsules** for large touch controls, segmented controls, and standout actions.
- **Concentric shapes** for nested surfaces: derive the inner radius from the parent radius and inset so corners share a visual center.

For a nested child, begin with `inner radius = max(0, parent radius - inset)` and adjust optically only when needed. Avoid pinched inner corners, unrelated radii, and capsules on every desktop control. Keep spacing and radius families small enough that relationships are visible.

## Design platform-appropriate controls

- Use one prominent treatment for the most likely action in a view; keep secondary actions quieter.
- Use a segmented control only for a small set of closely related options or subviews. Keep its items consistent in content type and width.
- Use a pop-up/select control for a flat list of mutually exclusive values; use a menu for commands.
- Use switches for important on/off settings; on macOS, prefer compact switches or checkboxes for dense grouped forms and dependent settings.
- Put screen-specific actions next to the content they affect. Keep persistent navigation free of contextual actions.
- Prefer a clear text label when a symbol is ambiguous. Keep symbol weight, optical size, and alignment consistent.
- Provide default, hover, focus-visible, pressed, disabled, loading, error, empty, and success behavior where applicable.

## Use typography and colour as structure

- Default to `system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif` on the web; never bundle Apple fonts without appropriate rights.
- Use bolder, left-aligned type at key moments, but match scale to the archetype. A desktop utility usually needs compact titles, not a product-page hero.
- Tighten tracking and leading progressively as display size grows. Keep body text near neutral tracking with comfortable leading.
- Define semantic roles such as `--bg-canvas`, `--bg-content`, `--bg-elevated`, `--bg-functional`, `--label-primary`, `--label-secondary`, `--separator`, `--tint`, `--danger`, and `--focus-ring`.
- Supply light, dark, and increased-contrast behavior. Do not invert a light palette mechanically or use the accent colour as decoration and interaction at the same time.
- Reserve tint for selection, status, and the primary action. When everything is tinted, nothing is prominent.

## Make motion explain relationships

Use motion to show origin, destination, state change, and direct manipulation. Keep passive layout motion restrained.

- Respond on pointer-down and track direct manipulation 1:1.
- Make gesture-driven motion interruptible. Retarget from the live presentation value and preserve velocity.
- Use a critically damped spring as the default; allow slight overshoot only when momentum or an elastic gesture justifies it.
- Enter and exit along symmetric paths. Open menus, popovers, and sheets from their trigger or spatial source.
- Project release velocity before choosing a drag snap point, then hand velocity to the spring.
- Use Pointer Events with pointer capture for custom dragging.
- Prefer transform and opacity for compositor-friendly motion. Avoid decorative whole-page blur/scale entrances in productivity tools.

For spring and gesture formulas, read [references/web-translation.md](references/web-translation.md).

## Adapt rather than merely shrink

Keep component anatomy and meaning stable while changing presentation:

- Wide desktop: expose useful depth, pointer precision, keyboard access, and comfortable information density.
- Intermediate width: collapse optional descriptions, allow navigation to become hideable, and preserve the current task.
- Narrow touch: replace a space-hungry sidebar with an appropriate tab bar, disclosure pattern, or drill-in navigation; enlarge hit regions without making every visual control enormous.
- At 200% zoom and with long/localized labels: reflow without clipping, overlap, or horizontal page scroll.

Base breakpoints on content pressure, not named devices. Preserve selection, draft state, scroll context, and in-progress operations during layout changes.

## Treat accessibility as part of the material system

- Meet WCAG 2.2 AA on the web and preserve semantic HTML, keyboard order, visible focus, accessible names, and live announcements.
- Maintain at least a 44×44 CSS-pixel touch hit region where touch is plausible; a smaller desktop visual can use an expanded invisible hit region.
- Never communicate selection, success, warning, or error by colour alone.
- Support text resize, forced/increased contrast, reduced motion, reduced transparency, light/dark appearance, and coarse pointer input.
- Under `prefers-reduced-motion`, remove bounce, parallax, depth travel, blur animation, and nonessential scaling; use a short fade or immediate state change.
- Under `prefers-reduced-transparency`, replace translucent navigation and transient surfaces with solid semantic backgrounds and clear separators.

## Audit and implementation workflow

1. Inspect repository instructions, current behavior, assets, styles, and component structure. Preserve existing user changes and functional invariants.
2. Render or inspect the interface at a representative wide and narrow viewport. Do not diagnose “feel” from token values alone when a visual can be obtained.
3. Record mismatches as observation, inference, and recommendation. Prioritize architecture and hierarchy before tokens and polish.
4. When the request involves “current,” “latest,” “trends,” or Liquid Glass, browse first-party Apple guidance and read [references/current-system.md](references/current-system.md). Separate durable principles from release-specific trends.
5. Define a compact design thesis, layer map, archetype, semantic tokens, component contracts, responsive behavior, and preserved invariants before broad styling changes.
6. Implement from outside in: canvas and shell, navigation, main content hierarchy, controls, states, then motion and finish.
7. Review the rendered result after each structural pass. If it still feels wrong, first remove excess surfaces, effects, scale, and ornament before adding anything.
8. Run relevant tests, lint, and build checks. Manually check keyboard use, light/dark mode, reduced motion, reduced transparency, narrow width, and zoom.

## Required quality gate

Reject the result if any answer is “no”:

- Is the product archetype evident without Apple branding?
- Does the primary action win through placement and hierarchy rather than saturation everywhere?
- Are content, functional, and transient layers visually distinct?
- Is glass limited to functional or transient elements, with no glass-on-glass stacking?
- Do compact desktop layouts remain compact?
- Are nested corners concentric and shape families intentional?
- Can every control be understood in default, selected, disabled, focus, and failure states?
- Does narrow layout preserve the same task instead of becoming a squeezed desktop?
- Do reduced-motion and reduced-transparency modes remain complete and legible?
- Has a visual review verified the composition, not just the code?

## Output format for design audits

Provide:

1. A one-paragraph design thesis and chosen archetype
2. A prioritized mismatch diagnosis with observations separated from inferences
3. A content/functional/transient layer map
4. Required changes by page region, followed by optional polish
5. Semantic token and component changes
6. Responsive, accessibility, and state behavior
7. Preserved invariants and non-goals
8. Observable acceptance criteria

For web implementation details and common failure patterns, read [references/web-translation.md](references/web-translation.md).
