# AK820 Pro manual test plan

Use the original AK820 Pro in wired USB-C mode (`0x0c45:0x8009`) with a current
Chromium browser. Do not test through Bluetooth or the 2.4 GHz receiver.

## 1. Connection and time

1. Connect the keyboard from the Device workspace.
2. Confirm the UI reports **Keyboard connected**.
3. Click **Sync now** and check the TFT clock.

Pass: connection succeeds and the clock updates without a disconnect or transfer
error.

## 2. TFT images

1. Upload a square PNG.
2. Upload a wide PNG and confirm the whole image remains visible with padding.
3. Upload a short animated GIF or WebP.
4. During a second animation upload, disconnect the cable and confirm the app
   reports failure and can reconnect.

Pass: static images match the preview, animation timing is reasonable, and the
app recovers after interruption. Transparent padding should appear black.

## 3. Preset lighting canaries

In Lighting, test each of these three times before running the full sweep:

1. Off
2. Steady, red, brightness 5
3. Spectrum Cycle
4. Twinkling Stars

Pass: every canary works three consecutive times. Stop here if one fails; a
full sweep would add noise rather than isolate the transport problem.

## 4. All preset effects

1. Open the **Testing** workspace. If it is hidden, set
   `VITE_SHOW_HARDWARE_TESTING=true` and restart or rebuild.
2. The current effect applies automatically. Observe the physical keyboard for
   at least one second.
3. Record the visible motion, palette behavior, and whether color, speed, and
   direction controls visibly change it. For reactive-looking effects, press
   several physical keys.
4. Compare the observation with the displayed frontend name and virtual preview,
   then record Works, Wrong effect, or No lighting. Use the note to describe the
   observed effect when the name or preview is wrong. An explicit application error is
   shown on screen and should be resolved before recording a physical result.
5. Each result copies the full report to the clipboard and automatically applies
   the next untested effect. Continue until all 20 are recorded.

Pass: every protocol effect ID has a physical result and enough detail to correct
its presentation metadata. An accepted command alone is not a pass.

## 5. Direction

1. Apply Cross-Wave with Up, then Down.
2. Apply Rolling Wave with Left, then Right.

Pass: movement matches each label. Record reversed Up/Down values before
changing the mapping because references disagree.

## 6. Sleep

1. Apply a one-minute lighting timeout.
2. Leave the keyboard untouched.

Pass: lighting turns off after approximately one minute and wakes normally.

## 7. Experimental per-key RGB

Only continue if the Per-key panel detects the optional command interface.

1. Read and save the current layout.
2. Paint only Esc red and apply.
3. Repeat with Q, Space, the ISO key if present, arrows, Delete, End, Page Up,
   and Page Down.
4. Test Fill all and Clear all.
5. Restore the saved lighting.
6. Reload and power-cycle to record persistence.

Pass: visual keys map to physical LEDs, editing causes no traffic before Apply,
and Restore recovers the previous state.

## 8. Shared-operation safety

1. Start a large animation upload.
2. Confirm time, lighting, sleep, and connection actions are disabled.
3. Repeat while disconnecting the keyboard.

Pass: operations never overlap, the active operation clears after failure, and
reconnection works.

## Known boundary

Preset lighting uses the AK820 Pro feature-report transaction. Per-key RGB is a
separate experimental protocol. TFT framing still combines AK820 Pro-specific
and closely related AKS075 evidence; alternatives are preserved in
[`protocol-notes.md`](protocol-notes.md) if physical display tests fail.
