import { describe, expect, test } from "vitest";
import { CHUNK_SIZE, RGB565_FRAME_BYTES } from "../constants";
import {
  buildImageCfgReport,
  buildImageDataChunks,
  buildImageSaveReport,
  buildImageStartReport,
} from "../image";

describe("buildImageStartReport", () => {
  test("returns START control packet with enable=0 (AKS075 framing)", () => {
    const msg = buildImageStartReport();
    expect(msg.reportId).toBe(0x04);
    expect(msg.bytes.byteLength).toBe(63);
    expect(msg.bytes[0]).toBe(0x18); // CMD_START
    // packet byte 8 (enable flag) → bytes[7] after stripping reportId
    expect(msg.bytes[7]).toBe(0x00);
    for (let i = 1; i < 63; i++) {
      if (i === 7) continue;
      expect(msg.bytes[i]).toBe(0);
    }
  });
});

describe("buildImageCfgReport", () => {
  test("encodes chunk count as uint16 LE with AKS075 sub-command 0x03", () => {
    const msg = buildImageCfgReport(8);
    expect(msg.reportId).toBe(0x04);
    expect(msg.bytes.byteLength).toBe(63);
    expect(msg.bytes[0]).toBe(0x72); // CMD_IMAGE
    expect(msg.bytes[1]).toBe(0x03);
    expect(msg.bytes[7]).toBe(8); // chunk count lo
    expect(msg.bytes[8]).toBe(0); // chunk count hi
  });

  test("encodes large chunk counts correctly (uint16 LE)", () => {
    const msg = buildImageCfgReport(0x0123);
    expect(msg.bytes[7]).toBe(0x23);
    expect(msg.bytes[8]).toBe(0x01);
  });

  test("rejects out-of-range chunk count", () => {
    expect(() => buildImageCfgReport(0)).toThrow(/chunk count/i);
    expect(() => buildImageCfgReport(0x10000)).toThrow(/chunk count/i);
  });
});

describe("buildImageSaveReport", () => {
  test("returns SAVE control packet (0x02, enable=0)", () => {
    const msg = buildImageSaveReport();
    expect(msg.reportId).toBe(0x04);
    expect(msg.bytes.byteLength).toBe(63);
    expect(msg.bytes[0]).toBe(0x02); // CMD_SAVE
    expect(msg.bytes[7]).toBe(0x00);
    for (let i = 1; i < 63; i++) {
      if (i === 7) continue;
      expect(msg.bytes[i]).toBe(0);
    }
  });
});

describe("buildImageDataChunks", () => {
  test("single static frame: 9 chunks of 4096 bytes each", () => {
    const frame = new Uint8Array(RGB565_FRAME_BYTES);
    const chunks = buildImageDataChunks([frame]);
    expect(chunks.length).toBe(9);
    for (const c of chunks) {
      expect(c.byteLength).toBe(CHUNK_SIZE);
    }
  });

  test("prepends a 256-byte static frame header before pixel data", () => {
    const frame = new Uint8Array(RGB565_FRAME_BYTES);
    frame[0] = 0x00;
    frame[1] = 0xf8;
    const chunks = buildImageDataChunks([frame]);
    expect(chunks[0][0]).toBe(0x01); // frame count
    expect(chunks[0][1]).toBe(0x00); // static frame delay
    for (let i = 2; i < 256; i++) {
      expect(chunks[0][i]).toBe(0xff);
    }
    expect(chunks[0][256]).toBe(0x00);
    expect(chunks[0][257]).toBe(0xf8);
  });

  test("padding fills bytes after the 32768 pixel bytes with 0xFF", () => {
    const frame = new Uint8Array(RGB565_FRAME_BYTES); // all zero
    const chunks = buildImageDataChunks([frame]);
    const pixelEnd = 256 + RGB565_FRAME_BYTES;
    for (let i = pixelEnd; i < chunks.length * CHUNK_SIZE; i++) {
      expect(chunks[Math.floor(i / CHUNK_SIZE)][i % CHUNK_SIZE]).toBe(0xff);
    }
  });

  test("multi-frame data uses one header and contiguous frames", () => {
    const frame = new Uint8Array(RGB565_FRAME_BYTES);
    const chunks = buildImageDataChunks([frame, frame, frame], [100, 100, 100]);
    expect(chunks.length).toBe(25);
  });

  test("encodes and clamps multi-frame delays in half-milliseconds", () => {
    const frame = new Uint8Array(RGB565_FRAME_BYTES);
    const chunks = buildImageDataChunks([frame, frame, frame], [1, 200, 600]);
    expect(chunks[0][0]).toBe(3);
    expect(chunks[0][1]).toBe(1);
    expect(chunks[0][2]).toBe(100);
    expect(chunks[0][3]).toBe(255);
  });

  test("each frame's pixel data follows the shared header contiguously", () => {
    const f0 = new Uint8Array(RGB565_FRAME_BYTES);
    f0[0] = 0xaa;
    f0[1] = 0xbb;
    const f1 = new Uint8Array(RGB565_FRAME_BYTES);
    f1[0] = 0xcc;
    f1[1] = 0xdd;
    const chunks = buildImageDataChunks([f0, f1], [100, 100]);
    const payload = new Uint8Array(chunks.flatMap((chunk) => [...chunk]));
    expect(payload[256]).toBe(0xaa);
    expect(payload[257]).toBe(0xbb);
    const frame1Offset = 256 + RGB565_FRAME_BYTES;
    expect(payload[frame1Offset]).toBe(0xcc);
    expect(payload[frame1Offset + 1]).toBe(0xdd);
  });

  test("rejects wrong-sized frame", () => {
    const frame = new Uint8Array(100);
    expect(() => buildImageDataChunks([frame])).toThrow(/32768/);
  });

  test("rejects mismatched delays length", () => {
    const frame = new Uint8Array(RGB565_FRAME_BYTES);
    expect(() => buildImageDataChunks([frame, frame], [100])).toThrow(/delay/i);
  });
});
