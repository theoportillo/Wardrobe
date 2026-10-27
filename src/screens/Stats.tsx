import { useEffect, useMemo, useState } from 'preact/hooks';
import { exportBackup, importBackup, lastExportAt, loadBackupMeta, parseBackup } from '../backup';
import { ItemDetail } from '../components/ItemDetail';
import { EmptyState, ItemImage, Progress } from '../components/ui';
import { CATEGORIES, DAY, FORGOTTEN_DAYS, label } from '../constants';
import { formatBytes, plural, relDay } from '../lib/format';
import { confirmDialog, go, items, outfits, reportError, toast, wipeAll } from '../store';
import type { Item } from '../types';

function Row({ item, right, onOpen }: { item: Item; right: string; onOpen: (id: string) => void }) {
  return (
    <button class="stat-row" onClick={() => onOpen(item.id)}>
      <div class={'stat-thumb' + (item.bgRemoved ? '' : ' photo')}><ItemImage id={item.id} version={item} /></div>
      <div class="stat-text">
        <span>{label.category(item.category)} {label.family(item.color.family).toLowerCase()}</span>
        {item.notes && <span class="muted small ellipsis">{item.notes}</span>}
      </div>
      <span class="stat-right">{right}</span>
    </button>
  );
}

export function Stats() {
  const all = items.value;
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      const est = await navigator.storage?.estimate?.();
      const persisted = (await navigator.storage?.persisted?.()) ?? false;
      if (est) setStorage({ usage: est.usage ?? 0, quota: est.quota ?? 0, persisted });
    })().catch(() => {});
  }, [all.length]);

  const now = Date.now();
  const s = useMemo(() => {
    const worn = all.filter((i) => i.timesWorn > 0).sort((a, b) => b.timesWorn - a.timesWorn);
    const least = [...all].sort((a, b) => a.timesWorn - b.timesWorn || (a.lastWornAt ?? 0) - (b.lastWornAt ?? 0));
    const forgotten = all
      .filter((i) => now - (i.lastWornAt ?? i.createdAt) > FORGOTTEN_DAYS * DAY)
      .sort((a, b) => (a.lastWornAt ?? a.createdAt) - (b.lastWornAt ?? b.createdAt));
    const totalWears = all.reduce((a, i) => a + i.timesWorn, 0);
    const byCat = CATEGORIES.map((c) => ({ ...c, n: all.filter((i) => i.category === c.id).length })).filter((c) => c.n);
    return { most: worn.slice(0, 5), least: least.slice(0, 5), forgotten, totalWears, byCat };
  }, [all]);

  async function doExport() {
    setBusy('Armando el respaldo…');
    try { if (await exportBackup()) toast('Respaldo exportado'); } catch (e) { reportError(e, 'No se pudo exportar'); }
    setBusy(null);
  }

  async function doImport(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setBusy('Leyendo el respaldo…');
    try {
      const b = await parseBackup(file);
      setBusy(null);
      const ok = await confirmDialog(`¿Importar ${plural(b.items.length, 'prenda', 'prendas')}?`, {
        body: `Respaldo del ${new Date(b.exportedAt).toLocaleDateString('es-AR')} con ${plural(b.outfits.length, 'outfit', 'outfits')}. Se suma a lo que ya tenés; si una prenda ya existe, se reemplaza por la del respaldo.`,
        ok: 'Importar',
      });
      if (!ok) return;
      setBusy('Importando…');
      await importBackup(b);
      toast(`Importadas ${plural(b.items.length, 'prenda', 'prendas')}`);
    } catch (err) {
      reportError(err, 'No se pudo importar');
    }
    setBusy(null);
  }

  async function doWipe() {
    const ok = await confirmDialog('¿Borrar todo el armario?', {
      body: `Se eliminan ${plural(all.length, 'prenda', 'prendas')}, sus fotos y ${plural(outfits.value.length, 'outfit', 'outfits')}. Exportá un respaldo antes si lo querés recuperar.`,
      ok: 'Borrar todo',
      danger: true,
    });
    if (!ok) return;
    try { await wipeAll(); await loadBackupMeta(); toast('Armario vacío'); } catch (e) { reportError(e); }
  }

  const open = openId ? all.find((i) => i.id === openId) ?? null : null;

  return (
    <section class="screen">
      <header class="screen-head"><h1>Estadísticas</h1></header>

      {all.length === 0 ? (
        <EmptyState emoji="📊" title="Sin datos todavía">
          <p class="muted">Cuando cargues prendas y marques qué usás, acá vas a ver qué es lo que más rotás y qué tenés olvidado.</p>
          <button class="btn primary" onClick={() => go('agregar')}>Agregar prendas</button>
        </EmptyState>
      ) : (
        <>
          <div class="kpis">
            <div class="kpi"><span class="kpi-n">{all.length}</span><span class="kpi-l">prendas</span></div>
            <div class="kpi"><span class="kpi-n">{s.totalWears}</span><span class="kpi-l">usos</span></div>
            <div class="kpi"><span class="kpi-n">{s.forgotten.length}</span><span class="kpi-l">olvidadas</span></div>
          </div>

          <div class="cat-bars">
            {s.byCat.map((c) => (
              <div class="cat-bar" key={c.id}>
                <span class="small">{c.label}</span>
                <div class="bar"><div style={{ width: `${(c.n / all.length) * 100}%` }} /></div>
                <span class="small num">{c.n}</span>
              </div>
            ))}
          </div>

          <h2 class="section-title">Más usadas</h2>
          {s.most.length ? s.most.map((i) => <Row key={i.id} item={i} onOpen={setOpenId} right={`${i.timesWorn}×`} />)
            : <p class="muted small">Todavía no marcaste ninguna como usada. Usá "La usé hoy" o "Usé este outfit".</p>}

          <h2 class="section-title">Menos usadas</h2>
          {s.least.map((i) => <Row key={i.id} item={i} onOpen={setOpenId} right={`${i.timesWorn}×`} />)}

          <h2 class="section-title">Prendas olvidadas <span class="muted small">· más de {FORGOTTEN_DAYS} días sin uso</span></h2>
          {s.forgotten.length ? s.forgotten.map((i) => <Row key={i.id} item={i} onOpen={setOpenId} right={i.lastWornAt ? relDay(i.lastWornAt) : 'nunca'} />)
            : <p class="muted small">¡Nada olvidado! Rotás bien tu ropa.</p>}
        </>
      )}

      <h2 class="section-title">Respaldo</h2>
      <div class="card">
        <p class="small muted">
          Tus prendas se guardan solo en este dispositivo. Exportá un respaldo (un .zip con datos y fotos) y guardalo en Drive, en tu compu o mandátelo por mail.
          {' '}{lastExportAt.value ? `Último respaldo: ${relDay(lastExportAt.value)}.` : 'Nunca exportaste.'}
        </p>
        {busy && <Progress ratio={null} label={busy} />}
        <div class="row wrap">
          <button class="btn primary grow" disabled={!!busy || !all.length} onClick={doExport}>Exportar respaldo</button>
          <label class={'btn ghost grow' + (busy ? ' disabled' : '')}>
            Importar
            <input type="file" accept=".zip,application/zip" hidden onChange={doImport} disabled={!!busy} />
          </label>
        </div>
        {storage && (
          <p class="small muted">
            Espacio usado: {formatBytes(storage.usage)}{storage.quota ? ` de ${formatBytes(storage.quota)} disponibles` : ''}.
            {' '}{storage.persisted ? 'Almacenamiento persistente activado ✓' : 'El navegador podría liberar estos datos si se queda sin espacio: exportá seguido.'}
          </p>
        )}
        {all.length > 0 && <button class="link danger-text small" onClick={doWipe}>Borrar todo el armario</button>}
      </div>

      {open && <ItemDetail key={open.id} item={open} onClose={() => setOpenId(null)} />}
    </section>
  );
}
