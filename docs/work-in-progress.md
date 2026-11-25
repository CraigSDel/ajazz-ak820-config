# Work in progress

Status as of 25 November 2026. Delete this file once the work below is committed or dropped.

## Where things stand

All of the work below is **uncommitted** on `main`: about 70 modified files, 9 deletions and 17
new files (`git status` lists them). The last commit is `89bea95 lighting animation updates`.

Checks at the time of writing:

| Check | Result |
| --- | --- |
| `npm test` | 179 tests pass |
| `npm run lint` | clean |
| `npm run build` | succeeds; JS bundle 69.6 KB (25.4 KB gzipped), CSS 64.8 KB (13.3 KB gzipped) |

The golden wire test ([src/__tests__/wire-golden.test.ts](../src/__tests__/wire-golden.test.ts))
records every byte sent to the keyboard by every operation. It still matches, so none of this work
has changed what goes over USB.

## Done

### Protocol and correctness review

- Every packet byte offset was checked against [protocol-notes.md](protocol-notes.md).
- Protocol builders now produce full 64-byte packets, so code indexes match the offsets in the
  docs. Shared helpers live in [src/protocol/packet.ts](../src/protocol/packet.ts).
- The acknowledgement read after lighting mode 4's data packet is now explicit. It used to
  happen only because the packet's first byte, `0x04`, matches the command prefix.
- Settings an effect doesn't use (palette, direction) reset when you switch effects, so they no
  longer leak into another effect's preview or packet (`configForEffect` in
  [src/lighting/effects.ts](../src/lighting/effects.ts)).
- Each key in [src/lighting/keyboard-layout.ts](../src/lighting/keyboard-layout.ts) carries its own
  firmware ID. Key IDs are no longer matched by array position.
- Colour presets follow the keyboard's own `Fn + →` cycle.
- Operations receive a narrower `DeviceTransport` type
  ([src/device/types.ts](../src/device/types.ts)). Every call checks that the operation still owns
  the device.
- The last-sent lighting is remembered per browser
  ([src/lighting/storage.ts](../src/lighting/storage.ts)). Long animated-image frames are kept by
  repeating them ([src/image/timing.ts](../src/image/timing.ts)).
- New bundled preset images come from
  [scripts/generate-presets.mjs](../scripts/generate-presets.mjs). The Pokémon images were removed.

### Readability pass

- `LightingMode.Effect1`…`Effect19` are renamed to the OEM driver's labels (`Static`, `Breath`,
  `Tilt`, …). Handshake modes are listed by name in
  [src/operations.ts](../src/operations.ts).
- The effect table uses named fields instead of positional booleans.
- Lighting packet offsets are named (`ModeDataOffset` in
  [src/protocol/lighting.ts](../src/protocol/lighting.ts)).
- Image selection handling moved from the panel into
  [src/image/prepare.ts](../src/image/prepare.ts). The preview decoder `rgb565ToRgba` sits beside
  the encoder in [src/image/rgb565.ts](../src/image/rgb565.ts).
- `LightingPanel` is split into smaller components: sleep settings, colour control, effect
  picker and level slider.
- Arrow-key navigation (`neighbouringKeyId`) and key positions (`keyCentre`) moved into the
  layout module.
- [src/ui/text.ts](../src/ui/text.ts) adds `classNames`, `plural` and `errorMessage`, which
  replace repeated inline code.
- One-letter names are spelled out, and needless casts and a redundant resize wrapper are gone.

**One intended behaviour change:** Up/Down in the per-key editor now moves to the key whose centre
is nearest. The old code ignored gaps, so about nine keys moved to the wrong neighbour; for
example, Up from `6` reached F6 instead of F5. The new behaviour is pinned down in
[keyboard-navigation.test.ts](../src/lighting/__tests__/keyboard-navigation.test.ts).

## Open decisions

1. **Effect identifier names.** The old design note said protocol code should use neutral
   identifiers, because effect names are only interpretations. The rename trades that for
   readability, and [learnings/lighting.md](learnings/lighting.md) now explains the choice. The
   rename can be reverted on its own: it is a mechanical find-and-replace.
2. **What to commit, and in how many commits.** The protocol review, the readability pass and the
   asset changes are separable.

## Not finished

### CSS consolidation

Two background runs from an earlier Claude session were consolidating the stylesheets. They were to
remove unused and overridden rules across [src/styles/](../src/styles/), then confirm that every
element's computed styles are unchanged at desktop and narrow widths. As of 18:03 they had written
nothing: the style files are unchanged since 16:50. Their headless Chrome processes were still
running.

Before restarting this work:

- Check whether those runs wrote anything: `git diff --stat -- src/styles src/index.css`.
- Two sessions edited this tree at once on 25 November and the edits overlapped. Make sure no other
  session is still editing the repo before starting.

### Needs the physical keyboard

These are listed in detail in [learnings/lighting.md](learnings/lighting.md):

- Preview animation timing is uncalibrated, so the UI labels the previews as approximate.
- The manual lists six brightness and speed levels, but the UI offers five, with no level 0.
- Up/Down direction encoding: the two reference implementations disagree.
- Time sync reads acknowledgements after two packets; the references read after every packet.
- Live per-key RGB sends SAVE ten times a second, as the OEM driver does. Possible flash wear is
  unconfirmed.
- Every lighting change is sent twice, because the first send sometimes doesn't commit.

### Planned but not started

[code-quality-plan.md](code-quality-plan.md) covers `CONTRIBUTING.md`, `AGENTS.md`, TypeScript
strict mode, CI format checks and Playwright tests with mocked WebHID.

## Resuming

1. Run `npm test`, `npm run lint` and `npm run build`. All three should pass as described above.
2. Settle the open decisions, then commit.
3. Pick the next item: the CSS consolidation, the hardware checks with
   [manual-test.md](manual-test.md), or the standards plan.
