# Manual-derived device behavior

[Learning index](README.md)

## Source and evidence boundary

These notes normalize the useful content from the published **AJAZZ AK820 PRO
Mechanical Keyboard Gasket Mounted Gaming Keyboard User Manual**, mirrored by
[Manuals+](https://manuals.plus/ajazz/ak820-pro-mechanical-keyboard-gasket-mounted-gaming-keyboard-manual)
(published July 15, 2024; page updated September 24, 2024).

The mirror is an independent publication, and its extracted text contains some
garbled key symbols and contradictory wording. Treat this document as evidence
of intended user-facing behavior, not as proof of USB protocol behavior. Prefer
physical testing, USB captures, and implementation evidence when they disagree.

## Published specification

- Model: AJAZZ AK820 PRO.
- Layout: 81 keys plus a metal volume knob; full-key anti-ghosting.
- Construction: gasket mount, ABS case, OEM-profile PBT keycaps.
- Size and weight: 327 × 136 × 40 mm and approximately 810 g.
- Connection: USB-C wired, 2.4 GHz wireless, and Bluetooth 5.1.
- Battery: 4000 mAh.
- Lighting: RGB with 20 built-in effect groups.
- Published host support: Windows Vista/7/8/10/11, macOS, and Android.
- Hot-swap sockets accept common three-pin and five-pin mechanical switches.

## Supplied product image

The supplied keyboard image shows an ANSI-style, compact 81-key layout in a
black case. This is useful visual evidence for the app's keyboard preview, but
colorways and regional keycaps may differ.

- The alphanumeric block has a standard horizontal ANSI Enter key, a long left
  Shift, and a shorter right Shift.
- The function row runs from Escape through `F1`–`F12`, followed by Delete.
- A narrow right-side column contains Home, Page Up, and Page Down beneath the
  rotary knob.
- The inverted-T arrow cluster occupies the lower-right corner.
- A small portrait-oriented color screen sits below Page Down and above the
  right arrow key.
- C and W status legends sit vertically between the main block and right-side
  column, matching the manual's Caps Lock and Win Lock indicators.
- The pictured styling uses dark-to-light gray keycaps, a black chassis, and
  yellow accent keycaps for Escape, Enter, and Space. These colors are cosmetic
  and should not be treated as fixed device behavior.
- The knob is a large black circle with a thin light-colored perimeter ring.

The image also confirms that the screen and knob are separate controls: the
knob is at the top-right while the TFT is at the bottom-right.

## Physical selectors and connections

The connection selector has three positions: Bluetooth, wired USB (the middle
and default position), and 2.4 GHz. Wired mode also charges the keyboard. A
separate selector chooses Windows or Mac behavior, with Windows as the default.

Bluetooth provides three stored channels:

| Channel | Select/reconnect | Pair | Key indication |
|---|---|---|---|
| 1 | Short press `Fn+Q` | Hold `Fn+Q` for 3 seconds | Q: slow flash while reconnecting, fast blue flash while pairing |
| 2 | Short press `Fn+W` | Hold `Fn+W` for 3 seconds | W: slow flash while reconnecting, fast cyan flash while pairing |
| 3 | Short press `Fn+E` | Hold `Fn+E` for 3 seconds | E: slow flash while reconnecting, fast purple flash while pairing |

In 2.4 GHz mode, R flashes green slowly while reconnecting. Holding `Fn+R` for
3 seconds forces receiver pairing and changes R to a fast green flash.

Browser configuration remains a wired-only capability; the availability of
Bluetooth and 2.4 GHz for ordinary keyboard input does not imply WebHID access.
See [Hardware and transport](hardware-and-transport.md).

## Status, power, and sleep

- The C indicator is white while Caps Lock is active.
- The W indicator is white while Win Lock, toggled with `Fn+Win`, is active.
- The battery indicator flashes red at low voltage, stays red while charging,
  and turns off when fully charged. The source later says it remains on when
  fully charged, so the fully-charged LED behavior requires physical checking.
- After 5 minutes without input, the backlight turns off; any key wakes it and
  reconnects Bluetooth or 2.4 GHz.
- After 30 minutes without input, the keyboard enters deep sleep and disconnects
  Bluetooth; any key wakes and reconnects it.
- The screen uses a zero-bar battery icon at low power. During charging it shows
  five bars and a lightning symbol; at full charge it shows five bars.

These are the keyboard's advertised autonomous power states. They are distinct
from the configurable lighting-sleep protocol described in [Lighting](lighting.md).

## Lighting shortcuts

The manual advertises shortcuts for cycling 20 effects, six brightness levels,
effect direction, color, six speed levels, light on/off, and factory reset.
The reliably transcribed bindings are:

- `Fn+Right Arrow`: cycle RGB, red, orange, yellow, green, cyan, blue, purple,
  white, then RGB again.
- `Fn+X`: toggle the lighting.
- Hold `Fn+Space` for 3–5 seconds: restore factory settings; the backlight
  flashes three times.

The source extraction corrupts the symbols for the effect-cycle, brightness,
direction, and speed keys. Consult the manual images or confirm on hardware
before documenting exact bindings for those actions.

Three user-recordable game-lighting slots are selected with `Fn+1`, `Fn+2`,
and `Fn+3`. Their defaults are described as FPS, MOBA/LOL, and a 37-key office
layout. `Fn+~` starts/saves recording, and repeated presses on a selected key
cycle through eight colors. Factory reset clears recorded lighting.

## Knob and screen

On the main screen, rotating the knob right increases volume, rotating left
decreases volume, and pressing it toggles mute. `Fn` plus a knob press enters
the screen settings; rotation navigates and a press confirms.

- `Fn+Delete`: toggle between the screen animation and main page.
- `Fn+Home`: turn the screen off or on.

The main page shows date, time, battery state, Windows/Mac mode, current
Bluetooth/2.4 GHz/USB connection, Win Lock, Caps Lock, and numeric-area state.
The settings page exposes lighting effect, color, brightness, speed, and screen
language controls.

## Hot-swap procedure

1. Remove the keycap with a keycap puller.
2. Grip the switch's upper and lower retaining tabs with a switch puller and
   pull the switch vertically out.
3. Align the replacement switch's pins with the socket holes.
4. Press the switch vertically into place.

Bent switch pins are easy to create during insertion, so alignment should be
checked before applying pressure.
