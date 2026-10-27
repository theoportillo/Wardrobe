import { classifyFamily, rgbToHex } from '../lib/colorMath';
import type { ItemColor } from '../types';
import { loadBitmap } from './process';

type Bucket = { w: number; r: number; g: number; b: number };

/**
 * Color principal de la prenda. Si la imagen tiene alfa usa solo los píxeles opacos;
 * si no, pondera el centro (donde suele estar la prenda). Histograma de 4 bits por canal,
 * sumando los buckets vecinos para no quedarse con un pico aislado.
 */
export async function extractColor(src: Blob): Promise<ItemColor> {
  const bmp = await loadBitmap(src, 80);
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);

  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 200) opaque++;
  const useAlpha = opaque < (data.length / 4) * 0.97;

  const buckets = new Map<number, Bucket>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 200) continue;
      let w = 1;
      if (!useAlpha) {
        const dx = (x / width - 0.5) * 2, dy = (y / height - 0.5) * 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.75) continue;
        w = 1 - dist;
      }
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bk = buckets.get(key) ?? { w: 0, r: 0, g: 0, b: 0 };
      bk.w += w; bk.r += r * w; bk.g += g * w; bk.b += b * w;
      buckets.set(key, bk);
    }
  }

  let best: Bucket | null = null;
  let bestScore = -1;
  for (const [key, bk] of buckets) {
    const r = key >> 8, g = (key >> 4) & 15, b = key & 15;
    let score = 0;
    for (let dr = -1; dr <= 1; dr++)
      for (let dg = -1; dg <= 1; dg++)
        for (let db = -1; db <= 1; db++) {
          const n = buckets.get(((r + dr) << 8) | ((g + dg) << 4) | (b + db));
          if (n) score += n.w;
        }
    if (score > bestScore) { bestScore = score; best = bk; }
  }
  if (!best) return { hex: '#8e8e93', family: 'gris' };
  const hex = rgbToHex(best.r / best.w, best.g / best.w, best.b / best.w);
  return { hex, family: classifyFamily(hex) };
}
