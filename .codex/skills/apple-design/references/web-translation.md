# Translating Apple design to the web

Read this reference when implementing or reviewing an Apple-coherent web interface.

## Web material model

Approximate relationships, not proprietary rendering.

```css
:root {
  color-scheme: light dark;
  --bg-canvas: #f5f5f7;
  --bg-content: #ffffff;
  --bg-elevated: #ffffff;
  --bg-functional: rgb(248 248 250 / 82%);
  --label-primary: #1d1d1f;
  --label-secondary: #6e6e73;
  --separator: rgb(60 60 67 / 18%);
  --tint: #0071e3;
  --danger: #d70015;
  --focus-ring: rgb(0 113 227 / 48%);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-canvas: #000000;
    --bg-content: #1c1c1e;
    --bg-elevated: #2c2c2e;
    --bg-functional: rgb(36 36 38 / 84%);
    --label-primary: #f5f5f7;
    --label-secondary: #a1a1a6;
    --separator: rgb(235 235 245 / 20%);
    --tint: #0a84ff;
    --danger: #ff453a;
    --focus-ring: rgb(10 132 255 / 58%);
  }
}
```

Treat these as starting relationships, not canonical Apple values. Tune to the product, verify contrast, and keep colour meanings semantic.

Use translucency only on persistent navigation or transient UI:

```css
.functional-layer {
  background: var(--bg-functional);
  border: 1px solid color-mix(in srgb, var(--separator) 70%, transparent);
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%), 0 12px 32px rgb(0 0 0 / 8%);
  backdrop-filter: blur(20px) saturate(150%);
}

.content-layer {
  background: var(--bg-content);
  /* No backdrop blur. Keep the work legible and visually stable. */
}

@media (prefers-reduced-transparency: reduce) {
  .functional-layer {
    background: var(--bg-elevated);
    backdrop-filter: none;
  }
}
```

If removing `backdrop-filter` barely changes the composition, the hierarchy is doing its job. If the interface collapses visually, it depends too much on the effect.

## Shape system

Define a small family and calculate nesting:

```css
:root {
  --radius-control: 8px;
  --radius-group: 12px;
  --radius-pane: 18px;
  --pane-inset: 6px;
  --radius-pane-inner: calc(var(--radius-pane) - var(--pane-inset));
}

.pane { border-radius: var(--radius-pane); padding: var(--pane-inset); }
.pane > .group { border-radius: var(--radius-pane-inner); }
.prominent-action, .segmented-control { border-radius: 999px; }
```

Do not assign radii independently to every component. Check corners at actual rendered size; optical corrections can be necessary when borders or asymmetric padding shift the apparent center.

## Desktop configurator pattern

For a hardware settings or configurator app, prefer:

```text
window/canvas
├── compact title/toolbar: identity, connection state, global actions
├── navigation: stable peer destinations
└── content pane
    ├── view title and concise description
    ├── preview or primary object, when useful
    ├── grouped settings rows
    ├── inline validation/status
    └── one clear apply/commit action when changes are staged
```

Use a sidebar on wide layouts only when peer destinations benefit from simultaneous visibility. Keep rows compact and descriptions subordinate. In narrow layouts, replace it with a tab bar or drill-in model; do not keep two competing persistent navigation bars.

Settings rows should generally align label, explanation, and control consistently. Use section boundaries sparingly. Keep controls near what they affect, and show dependencies through indentation, disclosure, or disabled state rather than additional cards.

## Control sizing

Separate the visible control from its hit area. Desktop pointer controls can look compact while still supporting touch when needed.

```css
.icon-button {
  position: relative;
  inline-size: 28px;
  block-size: 28px;
}

@media (pointer: coarse) {
  .icon-button {
    inline-size: 44px;
    block-size: 44px;
  }
}
```

Avoid globally setting every desktop button to a large minimum height. Set sizes by control role and input context.

## Typography

```css
:root {
  font: 400 100%/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.view-title {
  font-size: clamp(1.65rem, 1.3rem + 1.2vw, 2.25rem);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.035em;
}

.section-title {
  font-size: 0.95rem;
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: -0.01em;
}

.body-copy { max-inline-size: 65ch; }
```

Scale the title down for dense utilities and up only when the title is itself a meaningful content moment. Avoid uppercase eyebrow labels as a default habit; they often make a utility feel like a marketing page.

## Interaction and motion

Use a critically damped spring for touchable objects. When a library exposes `bounce` and a perceptual duration, begin near `bounce: 0`, `duration: 0.3–0.4`. Add slight bounce only after a flick, throw, or elastic drag.

Track release velocity and project the endpoint before snapping:

```js
function project(initialVelocity, decelerationRate = 0.998) {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}

const projected = currentPosition + project(releaseVelocity);
const target = nearestSnapPoint(projected);
animateTo(target, { initialVelocity: releaseVelocity });
```

For direct manipulation:

- use Pointer Events and `setPointerCapture`;
- preserve the grab offset;
- update position 1:1 during the drag;
- animate from the live on-screen value after interruption;
- retain velocity across retargeting;
- use progressive resistance beyond bounds;
- make enter and exit paths spatially symmetric.

Prefer no entrance animation for a static settings page. Animate only a meaningful view transition, disclosure, selection, upload progress, validation result, or object manipulation.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
  }

  .spatial-transition {
    animation: none;
    transition: opacity 120ms linear;
    transform: none;
    filter: none;
  }
}
```

## Visual audit order

Review screenshots in this order:

1. **Silhouette:** Does the broad navigation/content structure match the product archetype?
2. **Hierarchy:** Can the primary task and action be identified in two seconds?
3. **Density:** Does the information density match the input and task duration?
4. **Layering:** Are content and functional chrome distinct without effect overload?
5. **Geometry:** Are nested radii, control shapes, and alignments coherent?
6. **Type and colour:** Do semantic roles create a stable reading order in light and dark modes?
7. **States:** Are selection, focus, disabled, loading, error, and success unmistakable?
8. **Motion:** Does feedback explain causality without delaying work?
9. **Adaptation:** Does the same task remain coherent at narrow width, zoom, long labels, and alternate input?

Fix the earliest failing level first. Token polishing cannot repair the wrong silhouette or density.

## Common failed translation and correction

| Failed translation | Why it feels wrong | Correction |
| --- | --- | --- |
| Blur every card | Erases the distinction between content and controls | Keep content solid; limit glass to navigation/transient layers |
| Add gradients behind glass | Makes an effect the subject instead of the work | Let real content or a quiet canvas provide context |
| Use one large radius everywhere | Removes scale and hierarchy | Use fixed, capsule, and concentric families by role |
| Make every button 44px tall on desktop | Produces a stretched mobile interface | Keep compact visuals; enlarge hit areas for coarse input |
| Use huge titles and eyebrow labels in a utility | Imports product-page rhetoric into a work surface | Use compact view and section titles |
| Wrap every group in a bordered card | Creates repetitive visual noise | Use aligned rows, whitespace, and occasional separators |
| Animate page entry with blur and scale | Adds latency and spectacle without meaning | Animate only causal or spatial state changes |
| Make blue the default decoration | Confuses brand, interactivity, selection, and status | Reserve tint for interactive emphasis and state |
| Copy iOS controls onto wide desktop unchanged | Ignores precision input and deep workflows | Adapt density and presentation while preserving component anatomy |

## Acceptance checks

- At wide desktop width, navigation and settings remain compact and the work area dominates.
- At narrow width, navigation changes form without losing the current destination or staged changes.
- Removing blur leaves a clear, usable hierarchy.
- Nested containers show concentric corners with consistent inset relationships.
- Only one action per region uses prominent tint unless multiple actions are genuinely equal.
- Keyboard focus is visible and ordered; every custom control exposes its role, name, value, and state.
- At 200% zoom, controls and labels reflow without page-level horizontal scrolling.
- Reduced motion contains no bounce, parallax, blur animation, or large scaling.
- Reduced transparency yields solid, high-contrast functional and transient layers.
