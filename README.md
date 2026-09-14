# AJAZZ AK820 Pro Web Configurator

Configure the lighting and 128 × 128 TFT display on an AJAZZ AK820 Pro from a
Chromium browser. Nothing needs to be installed: the app communicates directly
with the keyboard over USB using WebHID.

**[Open the configurator](https://craigsdel.github.io/ajazz-ak820-config/)**

> [!WARNING]
> This is an independent, community-built project based on a reverse-engineered
> protocol. It is not affiliated with or endorsed by AJAZZ. Commands are sent
> directly to your keyboard, so use a stable wired connection and do not unplug
> or switch modes while an operation is running. Firmware differences may cause
> a failed transfer, lost settings, or require a keyboard reset. The software is
> provided without warranty; keep a recovery method for your keyboard revision.

## Before you start

This configurator has been hardware-tested with the original **AJAZZ AK820 Pro
with the 128 × 128 TFT display**.

| Requirement | Supported |
| --- | --- |
| Keyboard | Original AK820 Pro TFT (`VID 0x0c45`, `PID 0x8009`) |
| Connection | USB-C cable with the keyboard in wired mode |
| Browser | Chrome, Edge, Opera, or Arc (Chromium 89+) |
| Operating system | Windows, macOS, or Linux |

Safari and Firefox do not support WebHID. Bluetooth and the 2.4 GHz receiver do
not expose the configuration interface. Other AK820 variants—including Max, HE,
V2, and Sonix-based models—are not supported.

## Use the configurator

1. Connect the keyboard with a **data-capable USB-C cable**.
2. Set the keyboard's mode switch to **wired**.
3. Open the [web configurator](https://craigsdel.github.io/ajazz-ak820-config/)
   in Chrome or Edge.
4. Select **Device → Connect keyboard**, then choose the keyboard in the browser
   prompt. Grant access to both vendor HID interfaces if prompted.
5. Choose a workspace:

   - **Lighting** changes effects, colour, brightness, speed, direction, and the
     lighting sleep timer.
   - **Display** uploads a static image, animated image, or ordered image
     sequence to the TFT screen.
   - **Device** manages the USB connection and synchronises the TFT clock.
   - **Testing** contains experimental tools for validating lighting effects on
     physical hardware.

Changes are written directly to the keyboard. There is no account, cloud
service, or AJAZZ desktop driver involved.

## What works

- Synchronise the TFT clock with the computer's system time.
- Upload PNG, JPEG, WebP, animated GIF, and animated WebP images.
- Upload ordered multi-image sequences.
- Configure preset RGB effects, colour, brightness, speed, rainbow mode, and
  direction.
- Preview lighting effects on an approximate keyboard layout.
- Set the lighting sleep timeout.
- Paint live per-key RGB colours with fill and clear tools (experimental).

Key remapping and macro recording are not implemented because their device
protocols and safe restoration paths have not yet been confirmed.

### Image limits

| Input | Limit |
| --- | --- |
| Static PNG, JPEG, or WebP | 10 MB |
| Animated GIF or WebP | 20 MB, 2048 × 2048 px, 255 frames |
| One multi-file selection | 50 MB and 255 files total |
| Decoded GIF patch pixels | 50 million |
| Keyboard display | 128 × 128 px, RGB565 colour |

Images are scaled to fit without cropping. Opaque images use a detected
dominant colour for padding; images with transparency use black because the
display format has no alpha channel. Some colour reduction is expected after
conversion to RGB565.

### Experimental per-key lighting

Custom RGB uses a write-only feature-report transaction recovered from OEM
driver captures. The keyboard firmware returns to its stored preset unless the
custom table is continuously streamed, so live RGB runs only while the per-key
panel is open. Refreshes are scheduled start-to-start so USB transfer time does
not create a visible gap. The app cannot read or restore a previous custom
layout.

## Troubleshooting

### The keyboard is missing from the device picker

- Confirm that the cable supports data, not charging only.
- Put the keyboard in wired mode and disconnect the 2.4 GHz receiver.
- Reload the page after reconnecting the USB cable.
- Verify that the device identity is `0x0c45:0x8009`.

### The Connect button is unavailable

Use a Chromium browser and open the app over HTTPS or `localhost`. WebHID is not
available in Safari or Firefox and does not work in an insecure browser context.

### The keyboard stops responding

Press a key to wake it, then retry. If the app reports a disconnection, reconnect
from the Device workspace and grant both HID interface permissions when asked.
If necessary, unplug and reconnect the keyboard only after the current operation
has finished.

### Linux reports access denied

The browser may not have permission to open the keyboard's HID interfaces. Add
an appropriate `udev` rule for vendor ID `0c45` and product ID `8009`, then
restart the browser. The exact rule location and group vary by distribution.

### Revoke browser access

Chrome remembers WebHID permission until it is revoked. Remove it from
`chrome://settings/content/hid` (or the equivalent HID settings page in your
Chromium browser).

When reporting a hardware problem, include your OS, browser version, exact
keyboard model, connection mode, USB vendor/product IDs, firmware version if
known, the operation attempted, and the complete error message.

## Local development

Prerequisites: Node.js 22 (or a compatible current release) and npm.

```bash
git clone https://github.com/craigsdel/ajazz-ak820-config.git
cd ajazz-ak820-config
npm ci
npm run dev
```

Open <http://localhost:5173/ajazz-ak820-config/>. The app has no backend and the
AJAZZ desktop driver is not required.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run test` | Run unit and component tests once |
| `npm run test:coverage` | Run tests and enforce coverage thresholds |
| `npm run test:watch` | Re-run tests while files change |
| `npm run lint` | Check `src/` with Biome |
| `npm run format` | Format `src/` with Biome |
| `npm run build` | Type-check and create a production build |
| `npm run preview` | Preview the production build locally |

You can also run `./start.sh`; it installs locked dependencies when needed,
stops an older development server from this checkout, and starts on port 5173
without silently moving to another port. Set `APP_PORT` to choose a different
port, and pass additional arguments to Vite as usual, such as `./start.sh --host`.

The hardware Testing workspace is shown by default. To hide it, copy
`.env.example` to `.env.local`, set the following value, and restart the dev
server:

```dotenv
VITE_SHOW_HARDWARE_TESTING=false
```

## Project structure

```text
src/
├── device/      WebHID and mock device controllers
├── image/       Image decoding, resizing, and RGB565 conversion
├── lighting/    Lighting effects, colours, and keyboard layout
├── protocol/    Pure byte-level command builders
├── ui/          React interface components
└── operations.ts  High-level device operations
```

Further documentation:

- [Feature status and research backlog](docs/features.md)
- [Research, responsive contract, and RGB verification gates](docs/research-and-quality.md)
- [Protocol notes](docs/protocol-notes.md)
- [Physical hardware test plan](docs/manual-test.md)
- [Reverse-engineering notes and lessons](docs/learnings/README.md)

## Contributing

Bug reports, protocol findings, tests, and focused pull requests are welcome.
Before submitting code, run:

```bash
npm run test:coverage
npm run lint
npm run build
```

Coverage includes all application TypeScript and TSX except test setup and the
browser entry point. CI enforces minimum coverage of **70% statements**, **60%
branches**, **70% functions**, and **70% lines**. Every workflow run shows the
measured totals in its GitHub Actions summary and provides a downloadable HTML
report for 14 days. Thresholds are regression guards, not targets: new behavior
should include focused tests for its important success, failure, and boundary
paths.

Protocol changes should include byte-level fixtures or tests and, when possible,
the corresponding non-destructive check from the
[hardware test plan](docs/manual-test.md). Do not expose key remapping or macro
features until their packet formats and safe restoration paths are verified on
physical hardware.

## Security and privacy

Image processing and USB communication happen locally in the browser. The app
does not upload keyboard data or selected images to a server. Its production
bundle uses a restrictive Content Security Policy and allows no third-party
scripts, frames, forms, media, workers, or plugin content.

Because GitHub Pages does not support custom response headers, policies that
must be delivered as HTTP headers cannot all be enforced. In particular,
`frame-ancestors` is ignored when supplied through a `<meta>` element.

## Deployment

GitHub Actions tests, lints, and builds pull requests to `main`. Pushes to
`main` run the same checks and deploy to GitHub Pages. Forks derive their Pages
base path from the repository name. For a first deployment, select **GitHub
Actions** as the source under **Settings → Pages**.

## Credits

Protocol research builds on:

- [gohv/EPOMAKER-Ajazz-AK820-Pro](https://github.com/gohv/EPOMAKER-Ajazz-AK820-Pro)
  — AK820 Pro time synchronisation.
- [aar-rafi/aks075-linux](https://github.com/aar-rafi/aks075-linux) — image
  upload for a sibling keyboard.
- [TaxMachine/ajazz-keyboard-software-linux](https://github.com/TaxMachine/ajazz-keyboard-software-linux)
  — AK820 Pro cross-checks.
- [Beattrey/ajazz-ak820-config](https://github.com/Beattrey/ajazz-ak820-config)
  — reference implementation.
- [AJAZZ web application](https://ajazz.driveall.cn/) — supplementary AK820
  family metadata; it does not support this AK820 Pro.

## License

[MIT](LICENSE)
