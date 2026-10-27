/// <reference lib="webworker" />
import { removeBackground, type Config } from '@imgly/background-removal';

type Msg = { id: number; blob: Blob };

function run(blob: Blob, id: number, device: 'gpu' | 'cpu') {
  const config: Config = {
    model: device === 'gpu' ? 'isnet_fp16' : 'isnet_quint8',
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
    self.postMessage({ id, type: 'done', blob: out });
  } catch (err) {
    self.postMessage({ id, type: 'error', message: String((err as Error)?.message ?? err) });
  }
};
