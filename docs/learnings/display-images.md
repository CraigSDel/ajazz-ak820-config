# Display images

[Learning index](README.md)

## Screen format

The TFT is 128 × 128. Each row-major pixel is little-endian RGB565:

```text
pixel = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3)
frame size = 128 × 128 × 2 = 32768 bytes
```

RGB565 has no alpha channel. Transparent pixels become black.

## Browser pipeline

1. Decode static images with `createImageBitmap`, GIFs with `gifuct-js`, and
   animated WebP with `ImageDecoder`.
2. Aspect-fit without cropping.
3. Pad opaque images with a quantized dominant color.
4. Preserve transparency during composition, then flatten it to black.
5. Convert the finished RGBA frame to RGB565.

GIF composition honors keep-canvas, restore-background, and restore-previous
disposal methods. Size and decoded-pixel limits are enforced before expensive
work to protect the browser tab.

The enforced input limits are part of the browser-safety boundary and should
stay aligned with `src/image/static.ts`, `src/image/animated.ts`, and
`src/ui/ImagePanel.tsx`:

| Input | Current limit |
| --- | --- |
| Static file | 10 MiB |
| Animated file | 20 MiB |
| One multi-file selection | 50 MiB and 255 files |
| Animated canvas or frame descriptor | 2048 × 2048 px |
| Decoded animation | 255 frames |
| GIF patch pixels before decompression | 50 million total |

An animated selection can reach the 255-frame limit before the 255-file limit.
Validate the accumulated frame count after each decoded file so later files
cannot push the final upload header beyond what it can represent.

## Upload framing

The current sequence is:

1. START (`04 18`)
2. IMAGE_CFG (`04 72 03`) with a little-endian chunk count
3. 4096-byte data chunks, each followed by an ACK
4. SAVE (`04 02`)

The payload starts with a 256-byte header containing frame count and delays,
followed by consecutive 32768-byte frames. Static images use one frame. Multiple
selected files are decoded and concatenated into the same sequence; the device
does not expose independent image slots or playlists.

## Persistence and progress

Nine chunks are used for one static payload. Progress reflects acknowledged
chunks, not merely browser writes. SAVE is sent only after all ACKs arrive, then
the operation waits briefly before reporting success.

Uploads are serialized with every other device operation. Disconnecting or
missing an ACK stops the transaction and surfaces a recoverable error.

## Evidence boundary

The display path combines AK820 Pro-specific implementations with USB-captured
AKS075/Windows-driver evidence from closely related Sonix hardware. The AJAZZ
web application is supplementary only because it does not claim AK820 Pro
support.

An alternate AK820 Pro implementation uses 4123-byte logical chunks, no
256-byte header, and FINISH rather than SAVE. It is retained in
[`protocol-notes.md`](../protocol-notes.md) as a fallback if physical tests show
the current framing does not persist.

## Lessons retained

- Resize before RGB565 conversion.
- Composite animation patches before resizing.
- Detect real transparency rather than assuming it from file type.
- Reject oversized selections and animation metadata before decoding.
- Validate both selected-file count and accumulated decoded-frame count.
- Use acknowledged chunks as the progress boundary.
- Do not send SAVE after a failed chunk.
- Treat sequential uploads as replacement, not additional stored slots.
- Physical TFT output and persistence remain required release checks.
