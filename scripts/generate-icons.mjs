import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPng(size, rgb) {
  const [r, g, b] = rgb;
  const row = Buffer.alloc(1 + size * 3);
  const rows = [];
  for (let y = 0; y < size; y++) {
    const line = Buffer.alloc(1 + size * 3);
    line[0] = 0;
    for (let x = 0; x < size; x++) {
      const cx = x - size / 2;
      const cy = y - size / 2;
      const dist = Math.sqrt(cx * cx + cy * cy);
      const radius = size * 0.42;
      const i = 1 + x * 3;
      if (dist < radius) {
        // gradient-ish indigo
        const t = (y / size) * 0.4 + 0.6;
        line[i] = Math.min(255, Math.floor(r * t));
        line[i + 1] = Math.min(255, Math.floor(g * t));
        line[i + 2] = Math.min(255, Math.floor(b * (1.1 - t * 0.2)));
      } else {
        line[i] = 7;
        line[i + 1] = 7;
        line[i + 2] = 11;
      }
    }
    rows.push(line);
  }
  const raw = Buffer.concat(rows);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const color = [99, 102, 241];
writeFileSync(path.join(publicDir, "icon-192.png"), createPng(192, color));
writeFileSync(path.join(publicDir, "icon-512.png"), createPng(512, color));
console.log("Wrote PWA icons");
