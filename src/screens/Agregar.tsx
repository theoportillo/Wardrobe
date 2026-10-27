import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CutoutEditor } from '../components/CutoutEditor';
import { emptyDraft, ItemForm, type Draft } from '../components/ItemForm';
import { Icon, Progress } from '../components/ui';
import { extractColor } from '../image/color';
import { opaqueCopy, opaqueRatio, resizeToBlob, trimTransparent } from '../image/process';
import { removeBg, type BgProgress } from '../image/removeBg';
import { go, reportError, saveItem, toast, uid } from '../store';
import type { Item, ItemColor } from '../types';

type BgState =
  | { status: 'running'; progress: BgProgress | null }
  /** `blob` es el recorte alineado con la foto original (sin recortar bordes, para poder retocarlo). */
  | { status: 'done'; blob: Blob }
  | { status: 'failed'; message: string };

const useObjectUrl = (b: Blob | null) => {
  const url = useMemo(() => (b ? URL.createObjectURL(b) : null), [b]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
};

export function Agregar() {
  const [original, setOriginal] = useState<Blob | null>(null);
  const [bg, setBg] = useState<BgState | null>(null);
  const [useOriginal, setUseOriginal] = useState(false);
  const [detected, setDetected] = useState<ItemColor | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorStart, setEditorStart] = useState<Blob | null>(null);
  const token = useRef(0);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const origUrl = useObjectUrl(original);
  const cutUrl = useObjectUrl(bg?.status === 'done' ? bg.blob : null);

  const applyDetected = (c: ItemColor) => {
    setDetected(c);
    if (!draftRef.current.colorTouched) setDraft((d) => ({ ...d, color: c }));
  };

  async function onPick(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const t = ++token.current;
    setBusy(true);
    let resized: Blob;
    try {
      resized = await resizeToBlob(file, 1024, false, 0.88);
    } catch (err) {
      setBusy(false);
      reportError(err, 'No pude abrir esa imagen (probá con otra o sacá una captura)');
      return;
    }
    if (t !== token.current) return;
    setOriginal(resized);
    setUseOriginal(false);
    setDraft(emptyDraft());
    setDetected(null);
    setBusy(false);
    extractColor(resized).then((c) => t === token.current && applyDetected(c)).catch(() => {});

    setBg({ status: 'running', progress: null });
    try {
      const raw = await removeBg(resized, (progress) => t === token.current && setBg({ status: 'running', progress }));
      if ((await opaqueRatio(raw)) < 0.02) throw new Error('El recorte no encontró la prenda');
      if (t !== token.current) return;
      setBg({ status: 'done', blob: raw });
      extractColor(raw).then((c) => t === token.current && applyDetected(c)).catch(() => {});
    } catch (err) {
      console.warn('Recorte falló', err);
      if (t !== token.current) return;
      const offline = !navigator.onLine;
      setBg({ status: 'failed', message: offline ? 'Sin conexión: la primera vez hace falta internet para bajar el modelo de recorte.' : 'No se pudo quitar el fondo. Se va a guardar la foto original.' });
      setUseOriginal(true);
    }
  }

  async function openEditor() {
    if (!original) return;
    try {
      // Si el automático falló, se arranca con la foto entera y se borra a mano lo que sobra.
      setEditorStart(bg?.status === 'done' ? bg.blob : await opaqueCopy(original));
    } catch (err) { reportError(err, 'No pude abrir el editor'); }
  }

  function onEdited(b: Blob) {
    token.current++; // descarta un recorte automático que todavía esté en curso
    setEditorStart(null);
    setBg({ status: 'done', blob: b });
    setUseOriginal(false);
    extractColor(b).then(applyDetected).catch(() => {});
  }

  function reset() {
    token.current++;
    setOriginal(null);
    setBg(null);
    setDetected(null);
    setDraft(emptyDraft());
    setUseOriginal(false);
  }

  async function save() {
    if (!original || !draft.category) return;
    setSaving(true);
    try {
      const trimmed = bg?.status === 'done' && !useOriginal ? await trimTransparent(bg.blob) : null;
      const cut = trimmed?.blob ?? null;
      const full = cut ?? original;
      const thumb = await resizeToBlob(full, 360, !!cut, 0.8);
      const item: Item = {
        id: uid(),
        category: draft.category,
        color: draft.color,
        season: draft.season,
        occasions: draft.occasions,
        notes: draft.notes.trim(),
        createdAt: Date.now(),
        timesWorn: 0,
        lastWornAt: null,
        bgRemoved: !!cut,
        hasOriginal: !!cut,
        cutOffset: trimmed ? { x: trimmed.x, y: trimmed.y } : undefined,
      };
      await saveItem(item, { full, thumb, orig: cut ? original : null });
      reset();
      toast('¡Guardada! Podés sacar la próxima.');
    } catch (err) {
      reportError(err, 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  if (!original) {
    return (
      <section class="screen">
        <header class="screen-head"><h1>Agregar prenda</h1></header>
        <div class="pick">
          <label class={'pick-btn primary' + (busy ? ' disabled' : '')}>
            <input type="file" accept="image/*" capture="environment" onChange={onPick} disabled={busy} hidden />
            <Icon.camera /> <span>Sacar foto</span>
          </label>
          <label class={'pick-btn' + (busy ? ' disabled' : '')}>
            <input type="file" accept="image/*" onChange={onPick} disabled={busy} hidden />
            <Icon.image /> <span>Elegir de la galería</span>
          </label>
          {busy && <Progress ratio={null} label="Preparando la foto…" />}
          <ul class="tips muted">
            <li>Apoyá la prenda sobre un fondo liso que contraste con ella (ropa clara sobre fondo oscuro y al revés), con buena luz.</li>
            <li>Que entre entera en la foto y sin otras cosas alrededor.</li>
            <li>Si la cámara no abre, revisá el permiso de cámara del navegador o elegí desde la galería.</li>
          </ul>
        </div>
      </section>
    );
  }

  const showCut = bg?.status === 'done' && !useOriginal;
  const running = bg?.status === 'running';
  const p = running ? bg.progress : null;
  const progressLabel = !p ? 'Quitando el fondo…' : p.phase === 'download' ? 'Bajando el modelo de recorte (solo la primera vez)…' : 'Quitando el fondo…';

  return (
    <section class="screen">
      <header class="screen-head">
        <button class="btn ghost small" onClick={reset}>← Otra foto</button>
        <h1>Nueva prenda</h1>
      </header>

      <div class={'preview' + (showCut ? ' checker' : '')}>
        <img src={(showCut ? cutUrl : origUrl) ?? ''} alt="Vista previa" />
        {running && <div class="preview-overlay"><Progress ratio={p?.ratio ?? null} label={progressLabel} /></div>}
      </div>

      {bg?.status === 'done' && (
        <div class="cut-actions">
          <div class="segmented" role="tablist">
            <button role="tab" aria-selected={!useOriginal} class={!useOriginal ? 'on' : ''} onClick={() => setUseOriginal(false)}>Recortada</button>
            <button role="tab" aria-selected={useOriginal} class={useOriginal ? 'on' : ''} onClick={() => setUseOriginal(true)}>Original</button>
          </div>
          <button class="btn ghost" onClick={openEditor}>Retocar</button>
        </div>
      )}
      {bg?.status === 'failed' && (
        <div class="note warn">
          {bg.message}
          <div class="row"><button class="btn ghost small" onClick={openEditor}>Recortar a mano</button></div>
        </div>
      )}
      {editorStart && <CutoutEditor original={original} cutout={editorStart} onDone={onEdited} onCancel={() => setEditorStart(null)} />}

      <ItemForm draft={draft} onChange={setDraft} detected={detected} />

      <div class="sticky-actions">
        {running ? (
          <>
            <button class="btn ghost" disabled={!draft.category || saving} onClick={() => { token.current++; setBg({ status: 'failed', message: 'Recorte salteado.' }); setUseOriginal(true); }}>
              Saltear recorte
            </button>
            <button class="btn primary grow" disabled>Recortando…</button>
          </>
        ) : (
          <button class="btn primary grow" disabled={!draft.category || saving} onClick={save}>
            {saving ? 'Guardando…' : draft.category ? 'Guardar prenda' : 'Elegí una categoría'}
          </button>
        )}
      </div>
      <p class="center small"><a href="#armario" onClick={(e) => { e.preventDefault(); go('armario'); }}>Ver armario</a></p>
    </section>
  );
}
