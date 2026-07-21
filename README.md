# AJAZZ AK820 Pro Web Configurator

A browser-based tool to configure the AJAZZ AK820 Pro mechanical keyboard. Syncs system time and uploads static or animated images to the keyboard's 128×128 TFT screen via WebHID — no native install required.

**Live:** <https://craigsdel.github.io/ajazz-ak820-config/>

This is an independent, community-built project based on a reverse-engineered
device protocol. It is not affiliated with or endorsed by AJAZZ. Time and image
operations have protocol coverage, while the newer lighting features still need
broader validation on physical keyboards and firmware variants.

## Use at your own risk

This tool sends reverse-engineered commands directly to the keyboard and is
provided without a warranty. Differences between models or firmware revisions
could cause settings loss, a failed transfer, or require a keyboard reset. Keep
the official AJAZZ driver available as a recovery option, use a stable wired
connection, and do not unplug or switch modes while an operation is running.
You are responsible for deciding whether to use the tool with your hardware.

## Requirements

- **Browser**: Chrome / Edge / Opera / Arc (any Chromium ≥ 89). Safari and Firefox are not supported — they do not implement WebHID.
- **Connection**: USB-C in **wired** mode. The keyboard's vendor HID interface (used for time sync and image upload) is only exposed over USB; Bluetooth and the 2.4 GHz dongle do not expose it.
- **OS**: any — Chrome's WebHID works the same on macOS, Linux, and Windows.

The device picker currently recognizes USB vendor ID `0x0c45` and the wired
product IDs `0x8009` (AK820 family) and `0x800a` (AK820 Pro family), as listed
by the official AJAZZ online driver.
Other AK820 variants, layouts, and firmware revisions may use different HID
interfaces and are not currently supported.

## Usage

1. Plug the keyboard in via USB-C and set its mode switch to **wired**.
2. Open <https://craigsdel.github.io/ajazz-ak820-config/> in Chrome or Edge.
3. Click **Connect keyboard** and grant permission in the device picker.
4. Use the **Time**, **Lighting**, and **Image** panels. Changes are sent directly
   to the connected keyboard; there is no account or cloud service.

## Status

Implemented:

- System time sync to the TFT clock.
- Static image upload — PNG / JPEG / WebP.
- Multi-image sequences — choose several still or animated files and upload
  them as one ordered animation (up to 255 total frames).
- Animated GIF and WebP upload — frame timing retained; GIF disposal methods 0/1/2/3 honored.

Also implemented:

- RGB lighting effects, color, brightness, speed, rainbow, and direction.
- Corrected effect names and mode-specific controls derived from the official
  AJAZZ catalogue, with an explicitly approximate interactive preview.
- Experimental custom static per-key RGB with capability detection, backup and
  restore, gradients, presets, undo/redo, local profiles, and JSON import/export.
- Lighting sleep timeout.
- Shared device-operation locking across time, image, and lighting actions.

Not implemented: key remapping and macro recording; their device protocols
still require hardware capture and safe restoration research.

Custom RGB requires the keyboard to expose the official `0xff67` framed-command
HID interface. The editor remains read/write disabled when that interface is
not detected. The AK820 configuration does not advertise firmware GIF lighting,
so the editor intentionally creates static layouts only; it does not repeatedly
write frames to imitate an animation.

## Limits

- Static image: PNG / JPEG / WebP, up to **10 MB**.
- Animated GIF or WebP: up to **20 MB**, max **2048 × 2048 px**, max **255 frames**. GIF decoded patch pixels are limited to 50 M.
- All images are aspect-fitted to 128 × 128. Opaque images use dominant-color padding; images containing transparency use black because RGB565 has no alpha channel.

## Security

This page talks to your keyboard via WebHID. Chrome grants the permission **persistently** until you revoke it at `chrome://settings/content/hid`. The page makes no network requests — image processing and HID transport happen entirely in the browser.

The bundle ships with a strict Content-Security-Policy: no inline scripts, no third-party origins, no framing, no form submission.

## Development

The app uses React, TypeScript, Vite, the browser WebHID API, and Vitest. Local
development requires Node.js 22 or a compatible current Node.js release and
npm. No AJAZZ desktop driver or backend service is required.

```bash
npm ci
npm run dev      # opens http://localhost:5173/ajazz-ak820-config/
npm run test     # unit + component tests
npm run lint     # lint src/ with Biome
npm run build    # production build
npm run preview  # preview the production build locally
```

Use `npm run test:watch` while developing. Run `npm run format` to format files
under `src/` with Biome.

Alternatively, start the app from any directory with:

```bash
./start.sh
```

The script installs locked dependencies when needed and forwards any additional
arguments to Vite (for example, `./start.sh --host`).

## Architecture

- `src/protocol/` — pure byte-builder functions; fully unit-tested against byte-level fixtures.
- `src/image/` — File → RGB565 buffer transformations (static and animated).
- `src/device/` — WebHID-backed `DeviceController` plus a `MockDeviceController` for tests.
- `src/ui/` — React panels (Connect, TimeSync, Lighting, Image).
- `src/operations.ts` — high-level time, lighting, sleep, and image orchestration.

See [`docs/protocol-notes.md`](docs/protocol-notes.md) for byte-level protocol details and [`docs/manual-test.md`](docs/manual-test.md) for the hardware test plan.

The broader feature status and remaining hardware research are tracked in
[`docs/features.md`](docs/features.md). Reverse-engineering notes and lessons
learned are collected in [`docs/learnings/`](docs/learnings/README.md).

## Troubleshooting

- **The keyboard does not appear in the picker:** use a data-capable USB-C
  cable, select wired mode, disconnect the 2.4 GHz receiver, and reload the
  page. Bluetooth devices cannot be selected through WebHID.
- **The Connect button is unavailable:** open the site in a Chromium browser
  over HTTPS or from `localhost`. WebHID is unavailable in Firefox and Safari
  and requires a secure context.
- **The keyboard stops responding:** press a key to wake it, then retry. If the
  page still reports it as disconnected, reconnect through the Connection
  panel and grant access to both vendor HID interfaces when prompted.
- **Linux access is denied:** the browser may need permission to open the
  keyboard's HID interfaces. Check your distribution's `udev` configuration
  and restart the browser after changing device permissions.
- **A processed image looks different:** the display accepts RGB565 pixels at
  128 × 128, so colors and transparency are reduced during conversion. See the
  limits above for resizing and padding behavior.

When reporting a hardware issue, include the operating system, browser version,
keyboard model/layout, connection mode, USB vendor/product IDs, firmware
version if known, the operation attempted, and the exact error shown. Do not
attach proprietary AJAZZ driver binaries or captures containing unrelated USB
traffic.

## Contributing

Bug reports, protocol findings, tests, and focused pull requests are welcome.
Before submitting a code change, run:

```bash
npm run test
npm run lint
npm run build
```

Protocol changes should include byte-level fixtures or tests and, where
possible, the corresponding non-destructive hardware check from
[`docs/manual-test.md`](docs/manual-test.md). Key remapping and macro support
should not be exposed until their packet formats and safe restoration paths are
confirmed on physical hardware.

## GitHub Pages deployment

The production build is configured for
`https://craigsdel.github.io/ajazz-ak820-config/`. The
[`Deploy to GitHub Pages`](.github/workflows/deploy-pages.yml) workflow tests,
builds, and deploys the site after each push to `main`; it can also be run
manually from the repository's **Actions** tab.

For the first deployment, open **Settings → Pages** in GitHub and set **Source**
to **GitHub Actions**. WebHID requires a secure context, which the GitHub Pages
HTTPS URL provides.

## Credits

Protocol details derived from these reverse-engineering projects:

- [gohv/EPOMAKER-Ajazz-AK820-Pro](https://github.com/gohv/EPOMAKER-Ajazz-AK820-Pro) — time sync, AK820-Pro-specific.
- [aar-rafi/aks075-linux](https://github.com/aar-rafi/aks075-linux) — image upload, AKS075 sibling keyboard.
- [TaxMachine/ajazz-keyboard-software-linux](https://github.com/TaxMachine/ajazz-keyboard-software-linux) — AK820 Pro cross-check.
- [Beattrey/ajazz-ak820-config](https://github.com/Beattrey/ajazz-ak820-config) — reference implementation.
- [AJAZZ online driver](https://ajazz.driveall.cn/) — official WebHID bundle
  used to cross-check AK820-family TFT configuration, frame payloads, and
  device-reported limits.

## License

MIT — see [LICENSE](LICENSE).
