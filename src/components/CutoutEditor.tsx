import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { reportError } from '../store';
import { Progress } from './ui';

type Mode = 'erase' | 'restore';
const SIZES = [14, 28, 52]; // diámetro del pincel en px de pantalla
const MAX_UNDO = 12;

/**
 * Editor a pantalla completa para corregir el recorte con el dedo.
 * `cutout` tiene que estar alineado píxel a píxel con `original` (mismo tamaño, sin recortar bordes).
 */
export function CutoutEditor({ original, cutout, onDone, onCancel }: {
  original: Blob;
  cutout: Blob;
  onDone: (b: Blob) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<Mode>('erase');
  const [size, setSize] = useState(1);
  const [ready, setReady] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const [fit, setFit] = useState({ w: 0, h: 0 });

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const origBmp = useRef<ImageBitmap | null>(null);
  const undo = useRef<ImageData[]>([]);
  const modeRef = useRef(mode); modeRef.current = mode;
  const sizeRef = useRef(size); sizeRef.current = size;
  const viewRef = useRef(view); viewRef.current = view;

  const origUrl = useMemo(() => URL.createObjectURL(original), [original]);
  useEffect(() => () => URL.revokeObjectURL(origUrl), [origUrl]);

  useEffect(() => {
    document.body.classList.add('no-scroll');
    let alive = true;
    (async () => {
      const [o, c] = await Promise.all([createImageBitmap(original), createImageBitmap(cutout)]);
      if (!alive) return;
      origBmp.current = o;
      const cv = canvasRef.current!;
      cv.width = o.width; cv.height = o.height;
      cv.getContext('2d', { willReadFrequently: true })!.drawImage(c, 0, 0, o.width, o.height);
      c.close();
      const st = stageRef.current!.getBoundingClientRect();
      const k = Math.min(st.width / o.width, st.height / o.height);
      setFit({ w: o.width * k, h: o.height * k });
      setView({ s: 1, x: (st.width - o.width * k) / 2, y: (st.height - o.height * k) / 2 });
      setReady(true);
    })().catch((e) => { reportError(e, 'No pude abrir el editor'); onCancel(); });
    return () => { alive = false; origBmp.current?.close(); document.body.classList.remove('no-scroll'); };
  }, [original, cutout]);

  // ---------- Pintar ----------
  const ctx = () => canvasRef.current!.getContext('2d', { willReadFrequently: true })!;

  function toCanvas(clientX: number, clientY: number) {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return { x: ((clientX - r.left) * cv.width) / r.width, y: ((clientY - r.top) * cv.height) / r.height, k: cv.width / r.width };
  }

  function dab(x: number, y: number, radius: number) {
    const c = ctx();
    if (modeRef.current === 'erase') {
      c.save();
      c.globalCompositeOperation = 'destination-out';
      c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fill();
      c.restore();
    } else if (origBmp.current) {
      c.save();
      c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.clip();
      const sx = Math.max(0, x - radius), sy = Math.max(0, y - radius), d = radius * 2 + 2;
      c.drawImage(origBmp.current, sx, sy, d, d, sx, sy, d, d);
      c.restore();
    }
  }

  function line(a: { x: number; y: number }, b: { x: number; y: number }, radius: number) {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(dist / (radius / 3)));
    for (let i = 1; i <= steps; i++) dab(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps, radius);
  }

  // ---------- Gestos: 1 dedo pinta, 2 dedos hacen zoom/arrastre ----------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const stroke = useRef<{ last: { x: number; y: number }; snapshot: ImageData; drew: boolean } | null>(null);
  const pinch = useRef<{ d0: number; m0: { x: number; y: number }; v0: { s: number; x: number; y: number } } | null>(null);

  const stagePoint = (e: PointerEvent) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pinchState = () => {
    const [a, b] = [...pointers.current.values()];
    return { d: Math.hypot(b.x - a.x, b.y - a.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  function onDown(e: PointerEvent) {
    if (!ready) return;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* puntero ya liberado */ }
    pointers.current.set(e.pointerId, stagePoint(e));
    if (pointers.current.size === 1) {
      const p = toCanvas(e.clientX, e.clientY);
      const c = canvasRef.current!;
      stroke.current = { last: p, snapshot: ctx().getImageData(0, 0, c.width, c.height), drew: true };
      dab(p.x, p.y, (SIZES[sizeRef.current] / 2) * p.k);
    } else if (pointers.current.size === 2) {
      // El segundo dedo convierte el gesto en zoom: deshace lo que alcanzó a pintar el primero.
      if (stroke.current?.drew) ctx().putImageData(stroke.current.snapshot, 0, 0);
      stroke.current = null;
      const { d, m } = pinchState();
      pinch.current = { d0: d, m0: m, v0: viewRef.current };
    }
  }

  function onMove(e: PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, stagePoint(e));
    if (pinch.current && pointers.current.size >= 2) {
      const { d, m } = pinchState();
      const { d0, m0, v0 } = pinch.current;
      const s = Math.min(8, Math.max(1, (v0.s * d) / d0));
      setView({ s, x: m.x - ((m0.x - v0.x) * s) / v0.s, y: m.y - ((m0.y - v0.y) * s) / v0.s });
    } else if (stroke.current) {
      const p = toCanvas(e.clientX, e.clientY);
      line(stroke.current.last, p, (SIZES[sizeRef.current] / 2) * p.k);
      stroke.current.last = p;
    }
  }

  function onUp(e: PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (stroke.current && pointers.current.size === 0) {
      undo.current.push(stroke.current.snapshot);
      if (undo.current.length > MAX_UNDO) undo.current.shift();
      setUndoCount(undo.current.length);
      stroke.current = null;
    }
  }

  function doUndo() {
    const snap = undo.current.pop();
    if (snap) ctx().putImageData(snap, 0, 0);
    setUndoCount(undo.current.length);
  }

  function resetView() {
    const st = stageRef.current!.getBoundingClientRect();
    setView({ s: 1, x: (st.width - fit.w) / 2, y: (st.height - fit.h) / 2 });
  }

  async function done() {
    setSaving(true);
    canvasRef.current!.toBlob((b) => { setSaving(false); if (b) onDone(b); else reportError(new Error('No se pudo guardar el retoque')); }, 'image/png');
  }

  return (
    <div class="editor" role="dialog" aria-modal="true" aria-label="Retocar recorte">
      <div class="editor-top">
        <button class="btn ghost small" onClick={onCancel}>Cancelar</button>
        <span class="sheet-title">Retocar</span>
        <button class="btn primary small" onClick={done} disabled={!ready || saving}>{saving ? 'Guardando…' : 'Listo'}</button>
      </div>

      <div ref={stageRef} class="editor-stage" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {!ready && <div class="editor-loading"><Progress ratio={null} label="Abriendo…" /></div>}
        <div class="editor-content checker" style={{ width: `${fit.w}px`, height: `${fit.h}px`, transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}>
          <img src={origUrl} alt="" class={'editor-ghost' + (mode === 'restore' ? ' on' : '')} draggable={false} />
          <canvas ref={canvasRef} />
        </div>
      </div>

      <div class="editor-tools">
        <div class="segmented">
          <button class={mode === 'erase' ? 'on' : ''} onClick={() => setMode('erase')}>Borrar</button>
          <button class={mode === 'restore' ? 'on' : ''} onClick={() => setMode('restore')}>Recuperar</button>
        </div>
        <div class="row">
          <div class="brush-sizes" role="radiogroup" aria-label="Tamaño del pincel">
            {SIZES.map((s, i) => (
              <button key={s} role="radio" aria-checked={size === i} aria-label={['Chico', 'Mediano', 'Grande'][i]} class={'brush' + (size === i ? ' on' : '')} onClick={() => setSize(i)}>
                <i style={{ width: `${s * 0.55 + 6}px`, height: `${s * 0.55 + 6}px` }} />
              </button>
            ))}
          </div>
          <button class="btn ghost small" onClick={doUndo} disabled={!undoCount}>Deshacer</button>
          {view.s > 1.01 && <button class="btn ghost small" onClick={resetView}>Ver todo</button>}
        </div>
        <p class="small muted center">{mode === 'erase' ? 'Pasá el dedo por lo que sobra.' : 'Pasá el dedo por lo que falta de la prenda.'} Pellizcá para hacer zoom.</p>
      </div>
    </div>
  );
}
