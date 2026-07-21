# Display images

[Learning index](README.md)

## Screen format

The TFT is 128 × 128 and has no alpha channel. Every frame is RGB565
little-endian, row-major, with no row padding:

```text
pixel = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
bytes = [low_byte, high_byte]
frame size = 128 × 128 × 2 = 32768 bytes
```

## Browser image pipeline

All processing happens locally in the browser:

1. Decode static images with `createImageBitmap`, animated GIFs with
   `gifuct-js`, or animated WebPs frame-by-frame with WebCodecs `ImageDecoder`.
2. Resize with `containResizeRgba`, preserving the complete source without
   cropping.
3. Fill unused space for opaque sources using the dominant displayed color.
   The quantized 5-bit RGB histogram groups JPEG noise and similar shades.
4. Skip dominant-color fill when actual transparent pixels exist; flatten
   transparency to black only at the RGB565 conversion boundary.
5. Convert the composed RGBA frame to RGB565 little-endian.

GIF compositing honors keep-canvas, restore-background, and restore-previous
disposal methods. Transparent pixels do not overwrite prior canvas content.

## Upload protocol

The working AKS075/Windows-driver sequence is:

1. START: `04 18 00 ...`, with byte 7 equal to `0x00`.
2. IMAGE_CFG: `04 72 03 ...`, with uint16 little-endian chunk count in bytes
   8–9.
3. 4096-byte data-interface chunks, each followed by an ACK read.
4. SAVE: `04 02 00 ...`, with byte 7 equal to `0x00`.

### Payload framing

Every payload begins with a 256-byte frame header, including static images:

```text
[256-byte header] + [N × 32768-byte RGB565 frames] + [0xFF chunk padding]
```

Header byte 0 is frame count (`1–255`). Bytes 1 through N contain frame delays
as `delay_ms / 2`, clamped to `1–255`; static frame delay is `0`. Remaining
header bytes are `0xFF`.

A static payload is 33024 bytes and requires nine 4096-byte chunks. Animated
frames follow back-to-back without separators. Chunk count is
`ceil((256 + N × 32768) / 4096)`.

See [Hardware and transport](hardware-and-transport.md) for interface and ACK
handling.

## Multiple images and animations

The supported model is one committed frame sequence, not a collection of
independently addressable image or GIF slots. To show several pictures, convert
each picture to one or more frames, concatenate those frames in display order,
and upload the result as a single animation payload.

### Evidence

- The official [AJAZZ online driver](https://ajazz.driveall.cn/) contains direct
  AK820-family configurations for VID `0x0C45`, PID `0x8009` (`AK820`) and PID
  `0x800A` (`820PRO`), including a 128 × 128 TFT route. Its July 2026
  `layout-classic-ZwpimY8M.js` bundle provides the strongest model-specific
  evidence below.
- The AK820 Pro Windows-driver UI is frame-oriented. Its documented workflow
  adds selected images to a timeline, assigns delays to frames, and performs one
  "Upload to keyboard" action. Newer driver versions can import a GIF directly,
  but the editable result is still a frame timeline. See the
  [AK820 Pro driver walkthrough](https://www.whatgeek.com/ja/blogs/news/how-to-change-the-display-gif-of-the-ajazz-ak820-pro-keyboard)
  and the independently documented
  [multi-frame workflow](https://www.reddit.com/r/MechanicalKeyboards/comments/1bcdm8s/steps_for_uploading_a_gif_to_epomaker_ajazz_ak820/).
- The decompiled Windows-driver upload function in
  [aks075-linux](https://github.com/aar-rafi/aks075-linux) reads the current UI
  frame list, writes its length and per-frame delays into the 256-byte header,
  appends every frame's RGB565 pixels, and commits the combined buffer once.
- The wire format has no filename, asset identifier, slot number, playlist
  identifier, or command for selecting a stored image. Sequential uploads
  therefore replace the committed sequence rather than add independently
  selectable assets.

### Online-driver findings

The online driver's apparent image library is local application state, not a
set of keyboard slots. Each imported animation is appended to an `images`
array and persisted in browser storage under a key such as
`gif_files_w128h128`. Selecting an entry changes `currentImage`; the save action
uploads only `currentImage.frameData` through `setTftUserAnimation`.

The upload payload is one 256-byte header followed by one contiguous RGB565
frame array. The function accepts `delays[]` and `rgb565Pixels[]`, writes the
frame count to header byte 0, writes delay metadata, and transmits a single user
animation. Its command contains packet position, packet count, and a fixed
flash-related offset, but no user-animation identifier or slot number.

The site has a separate `SET_TFT_BUILT_IN_INDEX` command. That selector only
appears for configurations with `builtInCount > 1`; neither AK820 configuration
declares multiple built-ins. It selects firmware-provided content and is not
evidence of multiple writable user-animation slots.

The site reads `tftMaxFrames` as a uint16 from device-information bytes 22–23
and truncates uploads to the value reported by the connected keyboard. The
actual AK820 value therefore cannot be recovered from the bundle alone. The
payload still stores its frame count in one byte, consistent with an effective
limit no greater than 255.

GIF delays decoded in 10 ms units are multiplied by five before being written
to the header. This independently confirms a 2 ms device unit: a GIF delay of
10 represents 100 ms and becomes header value 50. One difference needs hardware
testing: the online driver writes delays for all but the final frame and writes
zero for the last delay, whereas the current animated builder clamps every
delay to at least one.

The outer transport is firmware-dependent. The online driver uses a generic
eight-byte `0xAA` header with command `0x50` (`SET_TFT_USER_ANIMATION`), packet
index/count, and a fixed flash offset. This project uses the observed
START → IMAGE_CFG → data chunks → SAVE transport. Their inner frame payloads
agree, but the working transport must not be replaced without testing the exact
keyboard and firmware.

The decompilation and USB capture are from the closely related AKS075 rather
than the AK820 Pro. The AK820 Pro UI and user reports independently corroborate
the frame-sequence behavior, but claims that the keyboard stores several GIFs
in selectable slots remain unverified. Reports that it "cycles through" several
GIFs may describe several animations concatenated into one timeline or projects
retained by the desktop software.

### Design consequences

- A multi-file UI should decode every selected PNG, JPEG, WebP, or GIF, flatten
  the results into one ordered `frames` and `delaysMs` sequence, and call the
  existing animated upload operation once.
- The protocol permits at most **255 total frames** because header byte 0 is a
  uint8 frame count. Input validation, documentation, and tests must use 255,
  not 256.
- Each delay is a uint8 in 2 ms units, so one frame can remain visible for
  2–510 ms. Longer still-image dwell times require repeated frames; those
  repetitions count toward the 255-frame limit.
- A full 255-frame payload contains about 8.36 MB of RGB565 pixels, plus the
  header and final chunk padding.

### Remaining hardware check

Before treating multi-file composition as confirmed across AK820 Pro firmware
variants, upload three distinct static frames with different delays through the
animated path. Verify ordering, timing, looping, persistence after sleep, and
persistence after changing connection modes. Also compare a normal final-frame
delay with the online driver's zero final-frame delay, read the device-reported
`tftMaxFrames`, and determine whether the same keyboard accepts the online
driver's `0xAA`/`0x50` transport. A packet capture from the AK820 Pro Windows
driver would still be required before adding any concept of separate
device-resident slots.

## Failed approaches

### Legacy gohv framing

The gohv-style static path does not persist reliably:

| Aspect | Legacy path | Working path |
|---|---|---|
| START byte 7 | `0x01` | `0x00` |
| IMAGE_CFG sub-command | `0x02` | `0x03` |
| Frame header | absent | required, even for one frame |
| Termination | FINISH (`0xF0`) | SAVE (`0x02`) |

FINISH resets player state rather than committing the image, causing a brief
flash followed by white or the default animation. Missing the header makes the
firmware interpret initial pixel bytes as metadata.

### Cover cropping

`cover` fills the TFT but discards portrait tops/bottoms or landscape sides.
Solid-color tests cannot detect this; edge-marker tests are necessary.

### Unconditional dominant-color fill

Filling all sources adds an unwanted surround to transparent PNGs and GIFs.
Transparency must be detected from pixel alpha, not MIME type, because PNG and
WebP may be opaque or transparent.
