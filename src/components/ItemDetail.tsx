import { useState } from 'preact/hooks';
import { label } from '../constants';
import { getImage } from '../db/db';
import { opaqueRatio, resizeToBlob, trimTransparent } from '../image/process';
import { removeBg } from '../image/removeBg';
import { plural, relDay } from '../lib/format';
import { confirmDialog, removeItem, reportError, saveItem, toast, wearItems } from '../store';
import type { Item } from '../types';
import { ItemForm, type Draft } from './ItemForm';
import { ItemImage, Progress, Sheet } from './ui';

export function ItemDetail({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [imgVersion, setImgVersion] = useState(0);

  const close = () => { setEditing(false); setDraft(null); onClose(); };
  if (!item) return null;

  const startEdit = () => {
    setDraft({ category: item.category, color: item.color, colorTouched: true, season: item.season, occasions: item.occasions, notes: item.notes });
    setEditing(true);
  };

  async function saveEdit() {
    if (!item || !draft?.category) return;
    try {
      await saveItem({ ...item, category: draft.category, color: draft.color, season: draft.season, occasions: draft.occasions, notes: draft.notes.trim() });
      setEditing(false);
      toast('Cambios guardados');
    } catch (e) { reportError(e, 'No se pudo guardar'); }
  }

  /** Intercambia la imagen principal con la alternativa guardada (recorte ⇄ original). */
  async function swapImage() {
    if (!item) return;
    setWorking('Cambiando imagen…');
    try {
      const [full, orig] = await Promise.all([getImage(item.id, 'full'), getImage(item.id, 'orig')]);
      if (!full || !orig) throw new Error('Falta una de las imágenes');
      const nowCut = !item.bgRemoved;
      const thumb = await resizeToBlob(orig, 360, nowCut, 0.8);
      await saveItem({ ...item, bgRemoved: nowCut }, { full: orig, orig: full, thumb });
      setImgVersion((v) => v + 1);
    } catch (e) { reportError(e, 'No se pudo cambiar la imagen'); }
    setWorking(null);
  }

  async function retryCut() {
    if (!item) return;
    setWorking('Quitando el fondo…');
    try {
      const full = await getImage(item.id, 'full');
      if (!full) throw new Error('No encontré la foto');
      const raw = await removeBg(full);
      if ((await opaqueRatio(raw)) < 0.02) throw new Error('El recorte no encontró la prenda');
      const cut = await trimTransparent(raw);
      const thumb = await resizeToBlob(cut, 360, true, 0.8);
      await saveItem({ ...item, bgRemoved: true, hasOriginal: true }, { full: cut, orig: full, thumb });
      setImgVersion((v) => v + 1);
      toast('Fondo quitado');
    } catch (e) { reportError(e, 'No se pudo quitar el fondo'); }
    setWorking(null);
  }

  async function del() {
    if (!item) return;
    const ok = await confirmDialog('¿Eliminar esta prenda?', { body: 'Se borra la foto y los outfits guardados que la usan. No se puede deshacer.', ok: 'Eliminar', danger: true });
    if (!ok) return;
    try { await removeItem(item.id); close(); toast('Prenda eliminada'); } catch (e) { reportError(e, 'No se pudo eliminar'); }
  }

  async function wore() {
    if (!item) return;
    try { await wearItems([item.id]); toast('¡Anotado! +1 uso'); } catch (e) { reportError(e); }
  }

  const wornToday = item.lastWornAt != null && relDay(item.lastWornAt) === 'hoy';

  return (
    <Sheet open onClose={close} title={editing ? 'Editar prenda' : label.category(item.category)}>
      <div class={'detail-img' + (item.bgRemoved ? ' checker' : '')}>
        <ItemImage id={item.id} kind="full" lazy={false} version={imgVersion} alt={label.category(item.category)} />
      </div>
      {working && <Progress ratio={null} label={working} />}

      {editing && draft ? (
        <>
          <div class="row wrap">
            {item.hasOriginal && (
              <button class="btn ghost small" disabled={!!working} onClick={swapImage}>
                {item.bgRemoved ? 'Usar foto original' : 'Usar recorte'}
              </button>
            )}
            {!item.hasOriginal && (
              <button class="btn ghost small" disabled={!!working} onClick={retryCut}>Quitar fondo</button>
            )}
          </div>
          <ItemForm draft={draft} onChange={(fn) => setDraft((d) => d && fn(d))} />
          <div class="row end">
            <button class="btn ghost" onClick={() => setEditing(false)}>Cancelar</button>
            <button class="btn primary" disabled={!draft.category} onClick={saveEdit}>Guardar</button>
          </div>
        </>
      ) : (
        <>
          <div class="facts">
            <span class="fact"><i class="dot" style={{ background: item.color.hex }} />{label.family(item.color.family)}</span>
            <span class="fact">{label.season(item.season)}</span>
            {item.occasions.map((o) => <span class="fact" key={o}>{label.occasion(o)}</span>)}
          </div>
          <p class="muted">
            Usada {plural(item.timesWorn, 'vez', 'veces')} · última: {relDay(item.lastWornAt)} · agregada {relDay(item.createdAt)}
          </p>
          {item.notes && <p class="notes">{item.notes}</p>}
          <button class="btn primary block" onClick={wore} disabled={wornToday}>
            {wornToday ? '✓ Usada hoy' : 'La usé hoy'}
          </button>
          <div class="row">
            <button class="btn ghost grow" onClick={startEdit}>Editar</button>
            <button class="btn ghost danger-text grow" onClick={del}>Eliminar</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
