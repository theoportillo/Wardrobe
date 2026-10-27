/// <reference lib="webworker" />
import { removeBackground, type Config } from '@imgly/background-removal';
import { composeCutout, refineAlpha } from './refineMask';

type Msg = { id: number; blob: Blob };

function run(blob: Blob, id: number, device: 'gpu' | 'cpu') {
  const config: Config = {
    // fp16 (88 MB) recorta bastante mejor que quint8 (44 MB) y también corre en CPU.
    model: 'isnet_fp16',
    device,
    output: { format: 'image/png', quality: 1 },
    progress: (key, current, total) => {
      self.postMessage({ id, type: 'progress', key, current, total });
    },
  };
  return removeBackground(blob, config);
}

async function hasWebGpu() {
  try {
    const gpu = (navigator as any).gpu;
    return !!(gpu && (await gpu.requestAdapter()));
  } catch {
    return false;
  }
}

async function pixels(blob: Blob) {
  const bmp = await createImageBitmap(blob);
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return ctx.getImageData(0, 0, c.width, c.height);
}

/** Limpia la máscara del modelo y recompone con los colores de la foto original. */
async function refine(original: Blob, cut: Blob): Promise<Blob> {
  const [orig, out] = await Promise.all([pixels(original), pixels(cut)]);
  if (orig.width !== out.width || orig.height !== out.height) return cut;
  const n = out.width * out.height;
  const alpha = new Uint8ClampedArray(n);
  for (let p = 0; p < n; p++) alpha[p] = out.data[p * 4 + 3];
  const refined = refineAlpha(alpha, out.width, out.height);
  const c = new OffscreenCanvas(out.width, out.height);
  c.getContext('2d')!.putImageData(new ImageData(composeCutout(orig.data, refined), out.width, out.height), 0, 0);
  return c.convertToBlob({ type: 'image/png' });
}

self.onmessage = async (e: MessageEvent<Msg>) => {
  const { id, blob } = e.data;
  const gpu = await hasWebGpu();
  try {
    let out: Blob;
    try {
      out = await run(blob, id, gpu ? 'gpu' : 'cpu');
    } catch (err) {
      if (!gpu) throw err;
      out = await run(blob, id, 'cpu');
    }
    self.postMessage({ id, type: 'progress', key: 'refine', current: 0, total: 0 });
    try {
      out = await refine(blob, out);
    } catch (err) {
      console.warn('No se pudo refinar la máscara', err);
    }
    self.postMessage({ id, type: 'done', blob: out });
  } catch (err) {
    self.postMessage({ id, type: 'error', message: String((err as Error)?.message ?? err) });
  }
};
