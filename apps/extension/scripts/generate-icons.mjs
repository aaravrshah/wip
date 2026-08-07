import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDirectory = join(root, 'public/icon');
const sizes = [16, 32, 48, 128];
const scale = 4;

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(name, data = Buffer.alloc(0)) {
  const type = Buffer.from(name);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, checksum]);
}

function insidePolygon(x, y, points) {
  let inside = false;
  for (
    let current = 0, previous = points.length - 1;
    current < points.length;
    previous = current++
  ) {
    const [currentX, currentY] = points[current];
    const [previousX, previousY] = points[previous];
    if (
      currentY > y !== previousY > y &&
      x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function roundedSquare(x, y) {
  const radius = 28;
  const nearestX = Math.max(radius, Math.min(128 - radius, x));
  const nearestY = Math.max(radius, Math.min(128 - radius, y));
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2;
}

function colorAt(x, y) {
  const wordmark = [
    [25, 38],
    [38, 91],
    [52, 91],
    [64, 61],
    [76, 91],
    [90, 91],
    [103, 38],
    [88, 38],
    [81, 71],
    [70, 43],
    [58, 43],
    [47, 71],
    [40, 38],
  ];
  if (!roundedSquare(x, y)) return [0, 0, 0, 0];
  if ((x - 103) ** 2 + (y - 27) ** 2 <= 8 ** 2) return [242, 166, 90, 255];
  if (insidePolygon(x, y, wordmark)) return [255, 255, 255, 255];
  return [23, 107, 82, 255];
}

function png(size) {
  const highSize = size * scale;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const totals = [0, 0, 0, 0];
      for (let sampleY = 0; sampleY < scale; sampleY += 1) {
        for (let sampleX = 0; sampleX < scale; sampleX += 1) {
          const sourceX = ((x * scale + sampleX + 0.5) / highSize) * 128;
          const sourceY = ((y * scale + sampleY + 0.5) / highSize) * 128;
          const color = colorAt(sourceX, sourceY);
          for (let channel = 0; channel < 4; channel += 1) totals[channel] += color[channel];
        }
      }
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        pixels[offset + channel] = Math.round(totals[channel] / (scale * scale));
      }
    }
  }

  const scanlines = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const offset = y * (size * 4 + 1);
    scanlines[offset] = 0;
    pixels.copy(scanlines, offset + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND'),
  ]);
}

await mkdir(outputDirectory, { recursive: true });
for (const size of sizes) await writeFile(join(outputDirectory, `${size}.png`), png(size));
process.stdout.write(`Generated Wip extension icons: ${sizes.join(', ')}px.\n`);
