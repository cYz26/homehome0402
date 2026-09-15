// Checks encoded metadata only. People/reflections still require visual review.
// --strip removes metadata without re-encoding the image pixels.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const strip = process.argv.includes('--strip');
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0').filter(path => /\.(png|jpe?g)$/i.test(path));

function cleanPng(b) {
  const keep = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'cHRM', 'gAMA', 'iCCP', 'sRGB', 'sBIT', 'pHYs']);
  const parts = [b.subarray(0, 8)];
  let pos = 8;
  while (pos < b.length) {
    const length = b.readUInt32BE(pos), type = b.toString('ascii', pos + 4, pos + 8);
    const end = pos + length + 12;
    assert(end <= b.length, 'Truncated PNG');
    if (keep.has(type)) parts.push(b.subarray(pos, end));
    pos = end;
    if (type === 'IEND') return Buffer.concat(parts);
  }
  throw new Error('Missing PNG IEND');
}

function cleanJpeg(b) {
  const parts = [b.subarray(0, 2)];
  let pos = 2;
  while (pos < b.length) {
    const start = pos;
    assert.equal(b[pos++], 0xff, 'Invalid JPEG marker');
    while (b[pos] === 0xff) pos++;
    const marker = b[pos++];
    if (marker === 0xd9) {
      parts.push(b.subarray(start, pos));
      return Buffer.concat(parts); // Exclude appended thumbnails/gain maps.
    }
    const length = b.readUInt16BE(pos), end = pos + length;
    assert(length >= 2 && end <= b.length, 'Truncated JPEG');
    const payload = b.subarray(pos + 2, end);
    const isApp = marker >= 0xe0 && marker <= 0xef;
    const isColor = (marker === 0xe2 && payload.subarray(0, 12).toString() === 'ICC_PROFILE\0')
      || (marker === 0xee && payload.subarray(0, 5).toString() === 'Adobe');
    if ((!isApp && marker !== 0xfe) || isColor) parts.push(b.subarray(start, end));
    pos = end;
    if (marker === 0xda) {
      const scanStart = pos;
      while (pos < b.length) {
        if (b[pos] !== 0xff) { pos++; continue; }
        let next = pos + 1;
        while (b[next] === 0xff) next++;
        if (b[next] === 0 || (b[next] >= 0xd0 && b[next] <= 0xd7)) { pos = next + 1; continue; }
        break;
      }
      parts.push(b.subarray(scanStart, pos));
    }
  }
  throw new Error('Missing JPEG EOI');
}

let affected = 0;
for (const path of files) {
  const before = readFileSync(path);
  const after = before.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    ? cleanPng(before) : before.readUInt16BE(0) === 0xffd8 ? cleanJpeg(before) : null;
  assert(after, `Unsupported image signature: ${path}`);
  if (!before.equals(after)) {
    affected++;
    if (strip) writeFileSync(path, after);
    console.log(`${strip ? 'Stripped' : 'Metadata found'}: ${path}`);
  }
}
console.log(`${files.length} tracked images checked; ${affected} ${strip ? 'sanitized' : 'need sanitization'}.`);
if (!strip && affected) process.exitCode = 1;
