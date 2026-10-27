import { useMemo, useState } from 'preact/hooks';
import { BackupBanner } from '../components/BackupBanner';
import { ItemDetail } from '../components/ItemDetail';
import { Chips, EmptyState, Icon, ItemImage, Sheet } from '../components/ui';
import { CATEGORIES, FAMILIES, OCCASIONS, SEASONS, label } from '../constants';
import { go, items, loaded } from '../store';
import type { Category, ColorFamily, Item, Occasion, Season } from '../types';

interface Filters {
  category: Category | null;
  families: ColorFamily[];
  season: Season | null;
  occasion: Occasion | null;
}
const noFilters: Filters = { category: null, families: [], season: null, occasion: null };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function matches(i: Item, f: Filters, q: string) {
  if (f.category && i.category !== f.category) return false;
  if (f.families.length && !f.families.includes(i.color.family)) return false;
  // "Todo el año" entra en cualquier estación.
  if (f.season && i.season !== f.season && i.season !== 'todo') return false;
  if (f.occasion && !i.occasions.includes(f.occasion)) return false;
  if (q) {
    const hay = norm([label.category(i.category), label.family(i.color.family), label.season(i.season), ...i.occasions, i.notes].join(' '));
    if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

export function Armario() {
  const [f, setF] = useState<Filters>(noFilters);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const all = items.value;
  const nq = norm(q.trim());
  const list = useMemo(() => all.filter((i) => matches(i, f, nq)), [all, f, nq]);
  const open = openId ? all.find((i) => i.id === openId) ?? null : null;
  const extra = f.families.length + (f.season ? 1 : 0) + (f.occasion ? 1 : 0);
  const usedFamilies = useMemo(() => new Set(all.map((i) => i.color.family)), [all]);

  if (loaded.value && all.length === 0) {
    return (
      <section class="screen">
        <header class="screen-head"><h1>Mi armario</h1></header>
        <EmptyState emoji="👕" title="Tu armario está vacío">
          <p class="muted">Sacale una foto a cada prenda y la app le quita el fondo sola. Con unas 10 prendas (arriba, abajo y calzado) ya te puede sugerir outfits.</p>
          <button class="btn primary" onClick={() => go('agregar')}>Agregar mi primera prenda</button>
        </EmptyState>
      </section>
    );
  }

  return (
    <section class="screen">
      <header class="screen-head">
        <h1>Mi armario</h1>
        <span class="muted small">{list.length === all.length ? `${all.length} prendas` : `${list.length} de ${all.length}`}</span>
      </header>
      <BackupBanner />

      <div class="searchbar">
        <span class="search-icon"><Icon.search /></span>
        <input type="search" placeholder="Buscar (ej: negro, lino, formal)" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <button class={'icon-btn badge-wrap' + (extra ? ' active' : '')} onClick={() => setShowFilters(true)} aria-label="Más filtros">
          <Icon.filter />
          {extra > 0 && <span class="badge">{extra}</span>}
        </button>
      </div>

      <div class="scroll-x">
        <Chips options={[{ id: 'all' as any, label: 'Todo' }, ...CATEGORIES]} value={f.category ?? ('all' as any)}
          onChange={(c: any) => setF({ ...f, category: c === 'all' ? null : c })} />
      </div>

      {list.length === 0 ? (
        <EmptyState emoji="🔍" title="Nada con esos filtros">
          <button class="btn ghost" onClick={() => { setF(noFilters); setQ(''); }}>Limpiar filtros</button>
        </EmptyState>
      ) : (
        <div class="grid">
          {list.map((i) => (
            <button key={i.id} class={'tile' + (i.bgRemoved ? '' : ' photo')} onClick={() => setOpenId(i.id)} aria-label={`${label.category(i.category)} ${label.family(i.color.family)}`}>
              <ItemImage id={i.id} version={i} />
              <i class="tile-dot" style={{ background: i.color.hex }} />
            </button>
          ))}
        </div>
      )}

      <Sheet open={showFilters} onClose={() => setShowFilters(false)} title="Filtros">
        <div class="form">
          <fieldset>
            <legend>Color</legend>
            <div class="swatches">
              {FAMILIES.filter((x) => usedFamilies.has(x.id)).map((x) => (
                <button key={x.id} class={'swatch' + (f.families.includes(x.id) ? ' on' : '')} style={{ background: x.hex }} aria-label={x.label} title={x.label}
                  onClick={() => setF({ ...f, families: f.families.includes(x.id) ? f.families.filter((y) => y !== x.id) : [...f.families, x.id] })} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Estación</legend>
            <Chips options={SEASONS.filter((s) => s.id !== 'todo')} value={f.season} allowNone onChange={(season) => setF({ ...f, season })} />
          </fieldset>
          <fieldset>
            <legend>Ocasión</legend>
            <Chips options={OCCASIONS} value={f.occasion} allowNone onChange={(occasion) => setF({ ...f, occasion })} />
          </fieldset>
          <div class="row end">
            <button class="btn ghost" onClick={() => setF({ ...noFilters, category: f.category })}>Limpiar</button>
            <button class="btn primary" onClick={() => setShowFilters(false)}>Ver {list.length}</button>
          </div>
        </div>
      </Sheet>

      {open && <ItemDetail key={open.id} item={open} onClose={() => setOpenId(null)} />}
    </section>
  );
}
