# UX and responsive layout

[Learning index](README.md)

## User job and information architecture

When connected in wired mode, the user wants to configure one hardware
capability, preview it, and apply it confidently. Connection is a prerequisite
and status—not the primary task occupying the page.

The interface therefore separates Lighting, Display, and Device into focused
workspaces. Only the active task is rendered. Connection health stays visible
in the header and links to Device recovery controls; time sync lives alongside
connection rather than competing as a top-level task.

## Control and feedback decisions

- Keep previews beside the controls they reflect.
- Use range inputs for brightness and speed to support rapid experimentation.
- Show one visually dominant apply action per task.
- Use explicit live regions for operation feedback only.
- Keep one keyboard as the hero surface for lighting. Its behavior should change
  between effect preview and per-key editing instead of rendering a second
  keyboard for advanced work.

HTML `output` has an implicit status role. Using it for visible range values
created competing live regions, so range values use ordinary text while native
sliders expose their values accessibly.

## Lighting-page refinement lesson

The lighting workspace should feel like a single, focused editor rather than a
form with a second keyboard attached. Effects and per-key editing are explicit
modes of the same keyboard surface. Switching modes changes the surrounding
controls and key interactions without changing the user's spatial anchor.

This pattern aligns with mainstream RGB software conventions: a prominent live
preview, a compact control surface, and contextual tools for the active mode. It
reduces visual clutter, preserves draft per-key work when modes change, and keeps
the separate effect and custom transports as an implementation detail.

## Lighting-control benchmark

Mainstream RGB tools treat effects as visual choices rather than ordinary form
values. [Razer Chroma Studio](https://mysupport.razer.com/app/answers/detail/a_id/13713/)
lists recognizable effect types and moves their parameters into a contextual
settings area. [Corsair iCUE](https://help.corsair.com/hc/en-us/articles/360045171512-I-CUE-How-to-Set-up-device-lighting-in-CORSAIR-iCUE)
similarly separates the lighting type from the settings and zones it controls.
[SignalRGB](https://docs.signalrgb.com/guides/effects-customization/how-to-customize-effects/)
keeps the preview above effect-specific controls and exposes only parameters
supported by the active effect.

The useful shared principles are:

- Make the current effect recognizable before opening its chooser.
- Give effect options a small visual signature, name, and short explanation.
- Keep the preview live while effect-specific parameters change.
- Use color swatches for fast common choices while retaining a precise color
  picker; swatches must also have accessible names and selected states.
- Hide unsupported parameters instead of presenting disabled form clutter.

The AK820 does not support desktop-style effect layers, cross-device zones, or
an online effect library. Copying those structures would add false complexity.
Its effect chooser is therefore a compact visual browser rather than a layer
editor. The color control uses a round color well, a readable hexadecimal value,
and quick swatches. Rounded containers and restrained shadows distinguish these
high-frequency visual controls from generic administrative form fields.

Device continuity matters as much as visual similarity. Corsair's documented
workflow uses the device preview itself for direct interaction, while
[SignalRGB's setup flow](https://docs.signalrgb.com/quick-start/first-time-setup/)
keeps one canvas visible and changes the customization controls around it. The
AK820 workspace follows that model: Effects and Per-key are modes of one mounted
keyboard canvas, not two matching keyboard components. The figure, rows, key
elements, dimensions, and scroll position stay stable. Only key color,
animation, accessible semantics, and pointer/keyboard behavior change.

This is an implementation invariant as well as a design rule. Sharing a layout
constant or component name is insufficient if conditional branches still mount
separate render trees. Tests retain references to the canvas and a key across a
mode switch to guard against that regression.

## Cross-workspace visual system

Polishing one workspace in isolation made the rest of the configurator feel like
an older application. Consistency therefore lives in shared primitives rather
than page-specific decoration:

- A small token set defines background layers, borders, text hierarchy, accent
  color, radii, and elevation.
- Navigation, panels, device frames, notices, inputs, and actions use the same
  rounded geometry and restrained depth.
- Red is reserved for selection, lighting, and the primary action; neutral
  surfaces carry secondary actions and configuration fields.
- Each workspace begins with a clear task heading, then presents its primary
  object or status before controls. Lighting shows the keyboard, Display shows
  the TFT frame, and Device shows connection health.
- Empty, disabled, busy, success, and error states keep their layout stable and
  use consistent inline feedback surfaces.
- Decorative device metaphors support recognition but never replace labels or
  accessible names.

Uniform does not mean identical page layouts. The shared shell and primitives
stay constant while each task keeps the structure best suited to its job:
preview-and-controls for Lighting, preview-and-upload for Display, and status
cards for Device. On narrow screens the header and workspaces stack, navigation
becomes a compact icon-and-label row, and wide hardware previews scroll inside
their own bounded surfaces rather than widening the document.

## Virtual-keyboard geometry

Every row uses a shared 16.75-unit width. Function-group spacers and the gap
before the navigation cluster are explicit layout units. Consequently a
one-unit key has the same width on every row, while Backspace, Enter, Shift,
modifiers, and Space preserve their relative sizes.

Normalizing rows independently with `flex-grow` does not work: rows have
different key totals, so identical keys acquire different widths. Resizing the
outer preview cannot fix that structural distortion.

On large screens the keyboard body is capped at 940 px and key depth increases.
This prevents the preview becoming a wide, shallow banner.

## Responsive contract

- Default desktop application ceiling: 1280 px.
- At 1280 px and above: restrained 1400 px application ceiling, stable editing
  columns, and bounded keyboard preview.
- At 880 px and below: sidebar becomes three-item top navigation and
  multi-column workspaces stack.
- At 520 px and below: lighting controls use one column and navigation helper
  text is visually hidden while descriptive accessible names remain.
- On narrow screens: preserve readable keyboard geometry and scroll the
  preview internally rather than shrinking labels beyond legibility.

## Large-screen lesson

Expanding the application to 1600 px and scaling key height fluidly made the
screen feel stretched. Fields became longer without becoming more usable, and
the keyboard lost believable proportions. Large screens need bounded content,
stable control widths, and intentional whitespace; available width is not a
target every component must fill.

## Accessibility contract

- All interactive elements are keyboard accessible with visible focus.
- Navigation exposes the current page with `aria-current` and descriptive
  names.
- Status, errors, and progress are announced without duplicate live regions.
- Meaning does not rely on color alone.
- Animation respects `prefers-reduced-motion`.
- Controls retain usable touch targets when the layout stacks.

Visual and automated evidence is recorded in [Validation](validation.md).
