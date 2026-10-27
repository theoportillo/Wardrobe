// Genera los íconos PNG de la PWA (una percha blanca sobre verde) sin dependencias.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x2d, 0x4a, 0x3e], FG = [0xf4, 0xf2, 0xee];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, px) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

// Percha en coordenadas 0..1 (escalada por `inner` para el área segura de maskable).
function hangerDist(x, y) {
  const segs = [
    [0.5, 0.42, 0.14, 0.68], [0.14, 0.68, 0.86, 0.68], [0.86, 0.68, 0.5, 0.42], // triángulo
    [0.5, 0.42, 0.5, 0.36],
  ];
  let d = Math.min(...segs.map((s) => segDist(x, y, ...s)));
  // gancho: arco de circunferencia centrado en (0.5, 0.29), r=0.07, de ~200° a ~-90°
  const cx = 0.5, cy = 0.29, r = 0.07;
  const a = Math.atan2(y - cy, x - cx);
  const inArc = a > -Math.PI * 1.0 && a < Math.PI * 0.5; // abierto abajo-izquierda
  if (inArc) d = Math.min(d, Math.abs(Math.hypot(x - cx, y - cy) - r));
  return d;
}

function render(size, { inner = 1, rounded = true } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const ss = 3; // supersampling
  const stroke = 0.045;
  const rad = rounded ? 0.22 : 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let cov = 0, bgCov = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const u = (x + (sx + 0.5) / ss) / size, v = (y + (sy + 0.5) / ss) / size;
      // fondo con esquinas redondeadas
      const qx = Math.max(Math.abs(u - 0.5) - (0.5 - rad), 0), qy = Math.max(Math.abs(v - 0.5) - (0.5 - rad), 0);
      if (Math.hypot(qx, qy) <= rad || rad === 0) bgCov++; else continue;
      const hu = (u - 0.5) / inner + 0.5, hv = (v - 0.5) / inner + 0.5 + 0.03;
      if (hangerDist(hu, hv) < stroke) cov++;
    }
    const n = ss * ss, i = (y * size + x) * 4, f = cov / n;
    for (let c = 0; c < 3; c++) px[i + c] = Math.round(BG[c] * (1 - f / (bgCov / n || 1)) + FG[c] * (f / (bgCov / n || 1)));
    px[i + 3] = Math.round((bgCov / n) * 255);
  }
  return png(size, px);
}

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('icon-192.png', out), render(192));
writeFileSync(new URL('icon-512.png', out), render(512));
writeFileSync(new URL('icon-maskable-512.png', out), render(512, { inner: 0.75, rounded: false }));
writeFileSync(new URL('apple-touch-icon.png', out), render(180, { inner: 0.85, rounded: false }));
writeFileSync(new URL('icon.svg', out), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#2d4a3e"/><g fill="none" stroke="#f4f2ee" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M43 32a7 7 0 1 1 7 7v6"/><path d="M50 45L14 71h72z"/></g></svg>`);
console.log('ok');
