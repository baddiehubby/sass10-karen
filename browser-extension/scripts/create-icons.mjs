import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "assets", "icons");

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = crcTable[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function blend(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
    lerp(a[3], b[3], t),
  ];
}

function createIcon(size) {
  const bytesPerPixel = 4;
  const stride = size * bytesPerPixel;
  const raw = Buffer.alloc((stride + 1) * size);
  const center = (size - 1) / 2;
  const radius = size * 0.43;
  const highlightX = size * 0.32;
  const highlightY = size * 0.25;
  const deep = [20, 24, 87, 255];
  const teal = [20, 184, 166, 255];
  const gold = [246, 215, 122, 255];
  const transparent = [0, 0, 0, 0];

  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (stride + 1);
    raw[rowOffset] = 0;

    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const offset = rowOffset + 1 + x * bytesPerPixel;
      let pixel = transparent;

      if (distance <= radius) {
        const edge = distance / radius;
        const base = blend(teal, deep, Math.min(1, edge * 0.95));
        const lightDistance = Math.sqrt((x - highlightX) ** 2 + (y - highlightY) ** 2);
        const light = Math.max(0, 1 - lightDistance / (size * 0.24));
        pixel = blend(base, gold, light * 0.75);
        pixel[3] = edge > 0.92 ? Math.round(255 * (1 - (edge - 0.92) / 0.08)) : 255;
      }

      raw[offset] = pixel[0];
      raw[offset + 1] = pixel[1];
      raw[offset + 2] = pixel[2];
      raw[offset + 3] = pixel[3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(outDir, { recursive: true });

for (const size of [16, 48, 128]) {
  writeFileSync(join(outDir, `icon${size}.png`), createIcon(size));
  console.log(`Created icon${size}.png`);
}
