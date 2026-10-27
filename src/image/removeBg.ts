export interface BgProgress {
  phase: 'download' | 'process';
  /** 0..1, o null si no se sabe. */
  ratio: number | null;
}

let worker: Worker | null = null;
let seq = 0;

function getWorker() {
  // El worker (y con él la librería y el modelo) se carga recién la primera vez que se recorta algo.
  worker ??= new Worker(new URL('./bg.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

/** Quita el fondo en un Web Worker. Rechaza si falla o si tarda más de `timeoutMs`. */
export function removeBg(blob: Blob, onProgress?: (p: BgProgress) => void, timeoutMs = 180_000): Promise<Blob> {
  const w = getWorker();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('El recorte tardó demasiado')); }, timeoutMs);
    const onMsg = (e: MessageEvent) => {
      const m = e.data;
      if (m.id !== id) return;
      if (m.type === 'progress') {
        const download = String(m.key).startsWith('fetch');
        onProgress?.({ phase: download ? 'download' : 'process', ratio: m.total ? m.current / m.total : null });
      } else if (m.type === 'done') { cleanup(); resolve(m.blob); }
      else if (m.type === 'error') { cleanup(); reject(new Error(m.message)); }
    };
    const onErr = (e: ErrorEvent) => {
      cleanup();
      w.terminate();
      worker = null;
      reject(new Error(e.message || 'Falló el worker de recorte'));
    };
    function cleanup() {
      clearTimeout(timer);
      w.removeEventListener('message', onMsg);
      w.removeEventListener('error', onErr);
    }
    w.addEventListener('message', onMsg);
    w.addEventListener('error', onErr);
    w.postMessage({ id, blob });
  });
}
