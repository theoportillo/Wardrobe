/**
 * Motor de combinaciones basado en reglas. Módulo puro (sin DOM ni IndexedDB) para poder
 * testearlo y reemplazarlo a futuro por otra implementación con la misma firma.
 */
import { DAY, FORGOTTEN_DAYS, label } from '../constants';
import type { Category, Item, Occasion, Season, Weather } from '../types';
import { judgeColors } from './colorRules';

export interface SuggestOptions {
  occasion?: Occasion | null;
  weather?: Weather | null;
  /** Outfits usados recientemente (con fecha), para no repetir. */
  history?: { itemIds: string[]; wornAt: number }[];
  /** No repetir outfits usados en los últimos N días (default 7). */
  noRepeatDays?: number;
  /** Combinaciones ya mostradas en esta sesión ("Otra idea"), como firma. */
  exclude?: string[];
  now?: number;
  /** Generador aleatorio [0,1). Inyectable para tests. */
  rng?: () => number;
}

export type SuggestResult =
  | { ok: true; itemIds: string[]; reason: string; score: number; signature: string }
  | { ok: false; message: string };

type Slot = 'top' | 'bottom' | 'shoes' | 'outer' | 'acc';

const SLOT_OF: Record<Category, Slot> = {
  remera: 'top', camisa: 'top', pantalon: 'bottom', short: 'bottom', abrigo: 'outer', calzado: 'shoes', accesorio: 'acc',
};

const SEASONS_FOR: Record<Weather, Season[]> = {
  frio: ['invierno', 'entretiempo', 'todo'],
  templado: ['entretiempo', 'todo', 'verano', 'invierno'],
  calor: ['verano', 'todo'],
};

const MAX_ENUMERATE = 6000;

/** Firma estable de un outfit (independiente del orden). */
export const signatureOf = (ids: string[]) => [...ids].sort().join('|');
/** Firma "de base" (arriba+abajo+calzado): dos outfits que solo cambian el accesorio cuentan como el mismo. */
const baseSignature = (ids: string[], byId: Map<string, Item>) =>
  signatureOf(ids.filter((id) => {
    const s = byId.get(id) && SLOT_OF[byId.get(id)!.category];
    return s === 'top' || s === 'bottom' || s === 'shoes';
  }));

function seasonOk(i: Item, w: Weather | null | undefined) {
  if (!w) return true;
  // En templado, las prendas de invierno pesadas (abrigos) sí; remeras de verano también.
  return SEASONS_FOR[w].includes(i.season);
}

/** Ocasiones efectivas: sin ocasiones = comodín. */
const occ = (i: Item): Occasion[] | null => (i.occasions.length ? i.occasions : null);

/** Las prendas tienen que compartir al menos una ocasión (así nunca se mezcla formal con deporte). */
function sharedOccasions(list: Item[]): Occasion[] | null {
  let acc: Set<Occasion> | null = null;
  for (const i of list) {
    const o = occ(i);
    if (!o) continue;
    acc = acc ? new Set(o.filter((x) => acc!.has(x))) : new Set(o);
    if (acc.size === 0) return [];
  }
  return acc ? [...acc] : null;
}

function itemScore(i: Item, now: number) {
  const last = i.lastWornAt ?? i.createdAt;
  const idleDays = Math.max(0, (now - last) / DAY);
  const freshness = Math.min(idleDays, FORGOTTEN_DAYS) / FORGOTTEN_DAYS; // 0..1
  const lowUse = 1 / (1 + i.timesWorn); // 1 si nunca se usó
  return 1 + 1.2 * freshness + 0.8 * lowUse;
}

function weightedPick<T>(xs: T[], weight: (x: T) => number, rng: () => number): T {
  const ws = xs.map(weight);
  let r = rng() * ws.reduce((a, b) => a + b, 0);
  for (let k = 0; k < xs.length; k++) {
    r -= ws[k];
    if (r <= 0) return xs[k];
  }
  return xs[xs.length - 1];
}

export function suggestOutfit(items: Item[], opts: SuggestOptions = {}): SuggestResult {
  const now = opts.now ?? Date.now();
  const rng = opts.rng ?? Math.random;
  const weather = opts.weather ?? null;
  const occasion = opts.occasion ?? null;
  const byId = new Map(items.map((i) => [i.id, i]));

  const pool = items.filter((i) => seasonOk(i, weather) && (!occasion || !occ(i) || i.occasions.includes(occasion)));
  const bySlot: Record<Slot, Item[]> = { top: [], bottom: [], shoes: [], outer: [], acc: [] };
  for (const i of pool) {
    if (weather === 'calor' && SLOT_OF[i.category] === 'outer') continue;
    bySlot[SLOT_OF[i.category]].push(i);
  }

  const missing = (['top', 'bottom', 'shoes'] as const).filter((s) => bySlot[s].length === 0);
  if (missing.length) {
    const names = { top: 'una remera o camisa/buzo', bottom: 'un pantalón o short/pollera', shoes: 'calzado' };
    const ctx = [occasion && `para ${label.occasion(occasion).toLowerCase()}`, weather && `con ${weather === 'frio' ? 'frío' : weather}`].filter(Boolean).join(' ');
    return { ok: false, message: `Me falta ${missing.map((m) => names[m]).join(', ')}${ctx ? ' ' + ctx : ''}. Agregá más prendas o probá otros filtros.` };
  }

  // Bases: arriba × abajo × calzado (enumeradas o muestreadas si son muchas).
  const scores = new Map(pool.map((i) => [i.id, itemScore(i, now)]));
  const total = bySlot.top.length * bySlot.bottom.length * bySlot.shoes.length;
  const bases: Item[][] = [];
  if (total <= MAX_ENUMERATE) {
    for (const t of bySlot.top) for (const b of bySlot.bottom) for (const s of bySlot.shoes) bases.push([t, b, s]);
  } else {
    const seen = new Set<string>();
    for (let k = 0; k < MAX_ENUMERATE; k++) {
      const pick = (xs: Item[]) => xs[Math.floor(rng() * xs.length)];
      const base = [pick(bySlot.top), pick(bySlot.bottom), pick(bySlot.shoes)];
      const sig = signatureOf(base.map((i) => i.id));
      if (!seen.has(sig)) { seen.add(sig); bases.push(base); }
    }
  }

  const repeatWindow = (opts.noRepeatDays ?? 7) * DAY;
  const recent = new Set(
    (opts.history ?? []).filter((h) => now - h.wornAt < repeatWindow).map((h) => baseSignature(h.itemIds, byId)),
  );
  const exclude = new Set(opts.exclude ?? []);

  type Cand = { list: Item[]; score: number; reason: string; base: string };
  const valid: Cand[] = [];
  for (const base of bases) {
    if ((sharedOccasions(base) ?? ['x']).length === 0) continue;
    const v = judgeColors(base.map((i) => i.color));
    if (!v.ok) continue;
    valid.push({ list: base, score: 0, reason: v.text, base: signatureOf(base.map((i) => i.id)) });
  }
  if (!valid.length) {
    return { ok: false, message: 'Con estas prendas no encontré combinaciones que respeten las reglas de color y ocasión. Sumá algún neutro (negro, blanco, gris, denim) o cambiá los filtros.' };
  }

  // Completa cada base con abrigo (si hace frío) y accesorio opcional, y puntúa.
  const complete = (c: Cand): Cand | null => {
    let list = c.list;
    let verdict = judgeColors(list.map((i) => i.color));
    const tryAdd = (cands: Item[], required: boolean) => {
      const ok = cands.filter((x) => {
        const l2 = [...list, x];
        return (sharedOccasions(l2) ?? ['x']).length > 0 && judgeColors(l2.map((i) => i.color)).ok;
      });
      if (!ok.length) return !required;
      const chosen = weightedPick(ok, (x) => scores.get(x.id)! ** 2, rng);
      list = [...list, chosen];
      verdict = judgeColors(list.map((i) => i.color));
      return true;
    };
    if (weather === 'frio' && bySlot.outer.length && !tryAdd(bySlot.outer, true)) return null;
    if (bySlot.acc.length && rng() < 0.5) tryAdd(bySlot.acc, false);

    const mean = list.reduce((a, i) => a + scores.get(i.id)!, 0) / list.length;
    const occBonus = occasion && list.every((i) => i.occasions.includes(occasion)) ? 0.2 : 0;
    const forgotten = list.find((i) => now - (i.lastWornAt ?? i.createdAt) > FORGOTTEN_DAYS * DAY);
    let reason = verdict.text;
    if (forgotten) reason += ` · rescata ${artDe(forgotten.category)} que hace rato no usás`;
    else if (weather === 'frio' && list.some((i) => SLOT_OF[i.category] === 'outer')) reason += ' · con abrigo para el frío';
    return { list, score: mean + verdict.bonus + occBonus, reason, base: c.base };
  };

  const tiers = [
    valid.filter((c) => !recent.has(c.base) && !exclude.has(c.base)),
    valid.filter((c) => !exclude.has(c.base)), // si ya mostré todo lo no-reciente, permito recientes
    valid, // y si ya mostré todo, vuelvo a empezar
  ];
  let tier = [...(tiers.find((t) => t.length) ?? valid)];

  // Elige con aleatoriedad ponderada (score^3 favorece lo bueno sin volverse determinístico).
  // Si la base elegida no admite ningún abrigo compatible (con frío), prueba con otra.
  const weight = (c: Cand) => (c.list.reduce((a, i) => a + scores.get(i.id)!, 0) / c.list.length + judgeColors(c.list.map((i) => i.color)).bonus) ** 3;
  let full: Cand | null = null;
  let first: Cand | null = null;
  for (let tries = 0; tries < 40 && tier.length && !full; tries++) {
    const picked = weightedPick(tier, weight, rng);
    first ??= picked;
    full = complete(picked);
    if (!full) tier = tier.filter((c) => c !== picked);
  }
  if (!full) {
    const base = first!;
    full = { ...base, reason: base.reason + ' · ojo: no encontré un abrigo que combine', score: 0 };
  }
  return { ok: true, itemIds: full.list.map((i) => i.id), reason: full.reason, score: full.score, signature: full.base };
}

function artDe(c: Category) {
  const fem: Category[] = ['remera', 'camisa'];
  return (fem.includes(c) ? 'una ' : 'un ') + label.category(c).toLowerCase().split(' /')[0];
}
