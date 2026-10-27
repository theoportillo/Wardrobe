import { useMemo, useState } from 'preact/hooks';
import { Collage } from '../components/Collage';
import { Chips, EmptyState, Icon } from '../components/ui';
import { OCCASIONS, WEATHERS } from '../constants';
import { signatureOf, suggestOutfit } from '../engine/suggestOutfit';
import { relDay } from '../lib/format';
import { deleteOutfitById, findOutfit, go, items, outfits, reportError, toast, upsertOutfit, wearItems } from '../store';
import type { Item, Occasion, Weather } from '../types';

type Current = { itemIds: string[]; reason: string; signature: string };

export function Outfit() {
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [current, setCurrent] = useState<Current | null>(null);
  const [shown, setShown] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const all = items.value;
  const byId = useMemo(() => new Map(all.map((i) => [i.id, i])), [all]);
  const history = useMemo(() => outfits.value.flatMap((o) => o.wornDates.map((wornAt) => ({ itemIds: o.itemIds, wornAt }))), [outfits.value]);
  const favorites = outfits.value.filter((o) => o.favorite && o.itemIds.every((id) => byId.has(id)));

  function suggest(exclude: string[]) {
    const r = suggestOutfit(all, { occasion, weather, history, exclude });
    if (!r.ok) { setError(r.message); setCurrent(null); return; }
    setError(null);
    setCurrent({ itemIds: r.itemIds, reason: r.reason, signature: r.signature });
    setShown([...exclude, r.signature]);
  }

  const changeFilter = (fn: () => void) => { fn(); setShown([]); };

  async function wore() {
    if (!current) return;
    try {
      const today = Date.now();
      await wearItems(current.itemIds, today);
      await upsertOutfit(current.itemIds, current.reason, (o) => ({ ...o, wornDates: [...o.wornDates, today] }));
      toast('¡Listo! Sumé un uso a cada prenda.');
    } catch (e) { reportError(e); }
  }

  async function toggleFav() {
    if (!current) return;
    try {
      const o = await upsertOutfit(current.itemIds, current.reason, (o) => ({ ...o, favorite: !o.favorite }));
      toast(o.favorite ? 'Guardado en favoritos' : 'Sacado de favoritos');
    } catch (e) { reportError(e); }
  }

  if (all.length === 0) {
    return (
      <section class="screen">
        <header class="screen-head"><h1>Outfit</h1></header>
        <EmptyState emoji="✨" title="Primero cargá tu ropa">
          <p class="muted">Necesito al menos una prenda de arriba, una de abajo y un calzado para armarte una combinación.</p>
          <button class="btn primary" onClick={() => go('agregar')}>Agregar prendas</button>
        </EmptyState>
      </section>
    );
  }

  const list = current ? (current.itemIds.map((id) => byId.get(id)).filter(Boolean) as Item[]) : [];
  const saved = current ? findOutfit(current.itemIds) : undefined;
  const wornToday = saved?.wornDates.some((d) => relDay(d) === 'hoy');

  return (
    <section class="screen">
      <header class="screen-head"><h1>¿Qué me pongo?</h1></header>

      <div class="form compact">
        <fieldset>
          <legend>Clima</legend>
          <Chips options={WEATHERS} value={weather} allowNone onChange={(w) => changeFilter(() => setWeather(w))} />
        </fieldset>
        <fieldset>
          <legend>Ocasión</legend>
          <Chips options={OCCASIONS} value={occasion} allowNone onChange={(o) => changeFilter(() => setOccasion(o))} />
        </fieldset>
      </div>

      {!current && (
        <button class="btn primary block big" onClick={() => suggest([])}>
          <Icon.sparkle /> Sugerime un outfit
        </button>
      )}

      {error && <p class="note warn">{error}</p>}

      {current && (
        <div class="outfit-card">
          <Collage items={list} />
          <p class="reason">{current.reason}</p>
          <div class="row">
            <button class="btn ghost grow" onClick={() => suggest(shown)}>Otra idea</button>
            <button class={'icon-btn fav' + (saved?.favorite ? ' on' : '')} onClick={toggleFav} aria-label={saved?.favorite ? 'Sacar de favoritos' : 'Guardar como favorito'} aria-pressed={!!saved?.favorite}>
              <Icon.star filled={saved?.favorite} />
            </button>
          </div>
          <button class="btn primary block" onClick={wore} disabled={wornToday}>{wornToday ? '✓ Lo usaste hoy' : 'Usé este outfit'}</button>
        </div>
      )}

      {favorites.length > 0 && (
        <>
          <h2 class="section-title">Favoritos</h2>
          <div class="fav-grid">
            {favorites.map((o) => (
              <div key={o.id} class="fav-item">
                <button class="fav-open" onClick={() => { setCurrent({ itemIds: o.itemIds, reason: o.reason, signature: signatureOf(o.itemIds) }); setError(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <Collage small items={o.itemIds.map((id) => byId.get(id)!)} />
                </button>
                <div class="fav-meta">
                  <span class="muted small">{o.wornDates.length ? `Usado ${relDay(o.wornDates[o.wornDates.length - 1])}` : 'Sin usar'}</span>
                  <button class="link small" onClick={async () => {
                    try {
                      if (o.wornDates.length) await upsertOutfit(o.itemIds, o.reason, (x) => ({ ...x, favorite: false }));
                      else await deleteOutfitById(o.id);
                    } catch (e) { reportError(e); }
                  }}>Quitar</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
