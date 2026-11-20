const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const S = size, cx = S / 2;
  const rows = [];
  for (let y = 0; y < S; y++) {
    const row = Buffer.alloc(1 + S * 3);
    for (let x = 0; x < S; x++) {
      const dx = (x - cx) / cx, dy = (y - cx) / cx;
      const r = Math.sqrt(dx * dx + dy * dy);
      const inner = r < 1;
      const flame = dy < 0.1 && dy > -0.95 && Math.abs(dx) < 0.12 - dy * 0.55 - Math.max(0, -0.7 - dy) * 0.9;
      const tongue = dy < 0.2 && dy > -0.5 && Math.abs(dx - (dy + 0.15) * 0.55) < 0.1 + Math.max(0, -dy) * 0.2;
      let c = inner ? [0x1a, 0x1d, 0x28] : [0x10, 0x12, 0x16];
      if (inner && r > 0.86) c = [0xff, 0x6a, 0x3d];
      if (inner && flame) c = [0xff, 0xd7, 0x6a];
      if (inner && tongue) c = [0xff, 0x9b, 0x5e];
      const o = 1 + x * 3;
      row[o] = c[0]; row[o + 1] = c[1]; row[o + 2] = c[2];
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, '..', 'res', 'mipmap-anydpi', 'ic_launcher.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png(432));
console.log('icon written:', out);
