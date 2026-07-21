# UX and responsive layout

[Learning index](README.md)

## Information architecture

The app separates four tasks:

- Lighting: preset and per-key configuration
- Display: TFT image and animation upload
- Device: connection and time sync
- Testing: optional physical effect validation

Only the active workspace is rendered. Connection health remains visible in the
header and links to recovery controls. The Testing workspace is hidden with
`VITE_SHOW_HARDWARE_TESTING=false` for normal deployments.

## Lighting workspace

Preset and per-key editing share one persistent virtual keyboard. Switching
modes changes controls and key interaction without remounting the keyboard,
losing the per-key draft, or shifting the page.

The effect picker shows recognizable names and small visual signatures. Only
supported color, palette, speed, and direction controls appear. The preview is
explicitly approximate; Apply is the only preset hardware write.

## Testing workspace

Hardware validation is kept out of normal configuration. The page records one
observation per mode, stores results locally, applies the next untested effect
automatically, and exports a plain-text report. Reactive modes remind the user
to press physical keys.

## Feedback and safety

- One dominant Apply action per task.
- Device operations share a global lock.
- Controls disable while an operation is active.
- Status messages use explicit live regions.
- Preview changes are distinguished from settings already applied.
- Destructive or experimental writes require clear context and recovery paths.

## Responsive behavior

Desktop layouts keep preview and controls together without exceeding the
content width. Narrow layouts stack panels, keep controls full-width, and avoid
horizontal overflow. The virtual keyboard may scale or scroll internally but
must not enlarge the document viewport.

The bottom navigation remains reachable above safe-area insets. Touch targets
retain usable height, while secondary descriptions may be hidden on very narrow
screens.

## Accessibility

- Native buttons, labels, fieldsets, ranges, and selects are preferred.
- Every icon-only or visual control has an accessible name.
- Focus indicators remain visible.
- Color is never the only state indicator.
- Decorative preview keys are removed from tab order; editable per-key controls
  become keyboard accessible.
- Reduced-motion preferences disable nonessential animations.

## Regression checks

- Only one virtual keyboard is mounted across Lighting modes.
- Switching workspaces reveals one task at a time.
- The Testing workspace can be both shown and hidden.
- At 390 px width, no element expands the document horizontally.
- Applied, busy, error, and disconnected states remain readable.

See [Validation](validation.md) for the automated and physical boundary.
