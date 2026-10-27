/** Decodifica (respetando la orientación EXIF) y escala para que el lado mayor no supere `max`. */
export async function loadBitmap(src: Blob, max = Infinity): Promise<ImageBitmap> {
  const bmp = await createImageBitmap(src, { imageOrientation: 'from-image' });
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (scale === 1) return bmp;
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const out = await createImageBitmap(bmp, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
  bmp.close();
  return out;
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toBlob(c: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo codificar la imagen'))), type, quality));
}

/** WebP si el navegador sabe codificarlo; si no (Safari viejo), PNG con alfa o JPEG sin alfa. */
async function encode(c: HTMLCanvasElement, alpha: boolean, quality = 0.85): Promise<Blob> {
  const webp = await toBlob(c, 'image/webp', quality);
  if (webp.type === 'image/webp') return webp;
  return alpha ? toBlob(c, 'image/png', 1) : toBlob(c, 'image/jpeg', quality);
}

export async function resizeToBlob(src: Blob, max: number, alpha: boolean, quality?: number): Promise<Blob> {
  const bmp = await loadBitmap(src, max);
  const c = canvas(bmp.width, bmp.height);
  const ctx = c.getContext('2d')!;
  if (!alpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return encode(c, alpha, quality);
}

/** Recorta el borde transparente sobrante (con un margen) para que la prenda llene la miniatura. */
export async function trimTransparent(src: Blob, pad = 0.04): Promise<Blob> {
  const bmp = await loadBitmap(src);
  const c = canvas(bmp.width, bmp.height);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error('El recorte quedó vacío');
  const p = Math.round(Math.max(x1 - x0, y1 - y0) * pad);
  x0 = Math.max(0, x0 - p); y0 = Math.max(0, y0 - p);
  x1 = Math.min(width - 1, x1 + p); y1 = Math.min(height - 1, y1 + p);
  const out = canvas(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return encode(out, true, 0.9);
}

/** Proporción de píxeles opacos: sirve para detectar recortes que se comieron la prenda. */
export async function opaqueRatio(src: Blob): Promise<number> {
  const bmp = await loadBitmap(src, 64);
  const c = canvas(bmp.width, bmp.height);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++;
  return n / (d.length / 4);
}
