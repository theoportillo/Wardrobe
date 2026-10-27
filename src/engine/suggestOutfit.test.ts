import { describe, expect, it } from 'vitest';
import { DAY } from '../constants';
import { classifyFamily } from '../lib/colorMath';
import type { Category, Item, Occasion, Season } from '../types';
import { judgeColors } from './colorRules';
import { suggestOutfit } from './suggestOutfit';

const NOW = new Date('2026-10-27T12:00:00').getTime();

function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

let n = 0;
function item(category: Category, hex: string, extra: Partial<Item> = {}): Item {
  return {
    id: `${category}-${++n}`,
    category,
    color: { hex, family: classifyFamily(hex) },
    season: 'todo' as Season,
    occasions: ['casual'] as Occasion[],
    notes: '',
    createdAt: NOW - 10 * DAY,
    timesWorn: 0,
    lastWornAt: null,
    bgRemoved: true,
    hasOriginal: true,
    ...extra,
  };
}

const NEGRO = '#151515', BLANCO = '#f7f7f5', DENIM = '#4a6587', GRIS = '#8a8a8a';
const ROJO = '#d62828', VERDE = '#2f9e44', AMARILLO = '#f5c518', NARANJA = '#e8590c', CELESTE = '#74c0fc';

describe('classifyFamily', () => {
  it('reconoce neutros de placard', () => {
    expect(classifyFamily(NEGRO)).toBe('negro');
    expect(classifyFamily(BLANCO)).toBe('blanco');
    expect(classifyFamily(GRIS)).toBe('gris');
    expect(classifyFamily(DENIM)).toBe('denim');
    expect(classifyFamily('#1f2a44')).toBe('marino');
    expect(classifyFamily('#d8c3a5')).toBe('beige');
    expect(classifyFamily('#6b4a33')).toBe('marron');
  });
  it('reconoce colores', () => {
    expect(classifyFamily(ROJO)).toBe('rojo');
    expect(classifyFamily(VERDE)).toBe('verde');
    expect(classifyFamily(AMARILLO)).toBe('amarillo');
    expect(classifyFamily(CELESTE)).toBe('celeste');
  });
});

describe('judgeColors', () => {
  const c = (hex: string) => ({ hex, family: classifyFamily(hex) });
  it('neutros combinan con todo', () => {
    expect(judgeColors([c(NEGRO), c(BLANCO), c(DENIM)]).ok).toBe(true);
  });
  it('un acento sobre base neutra', () => {
    const v = judgeColors([c(VERDE), c(DENIM), c(BLANCO)]);
    expect(v.ok).toBe(true);
    expect(v.text).toBe('Base neutra + un acento verde');
  });
  it('rechaza dos colores vivos distintos', () => {
    expect(judgeColors([c(ROJO), c(VERDE), c(NEGRO)]).ok).toBe(false);
    expect(judgeColors([c(AMARILLO), c(NARANJA)]).ok).toBe(false);
  });
  it('acepta un vivo con un apagado análogo o complementario', () => {
    expect(judgeColors([c(ROJO), c('#9fb8a0')]).ok).toBe(true); // verde salvia apagado: complementario
    expect(judgeColors([c('#2e6bd1'), c('#a8d8ea')]).ok).toBe(true); // azul + celeste pastel: análogos
  });
  it('rechaza colores que chocan (ni análogos ni complementarios)', () => {
    expect(judgeColors([c('#2f9e44'), c('#e8a0bf'), c(NEGRO)]).ok).toBe(true); // verde/rosa ≈ complementarios
    expect(judgeColors([c('#d9a5a5'), c('#a5d9d9')]).ok).toBe(true); // rosa viejo + aqua (~180°)
    expect(judgeColors([c('#e0b0b0'), c('#b0b0e0')]).ok).toBe(false); // rosa viejo + lavanda (~120°)
  });
});

function wardrobe() {
  n = 0;
  return [
    item('remera', BLANCO), item('remera', NEGRO), item('remera', VERDE), item('camisa', CELESTE, { occasions: ['formal', 'salida'] }),
    item('remera', ROJO, { occasions: ['deporte'], season: 'verano' }),
    item('pantalon', DENIM, { occasions: ['casual', 'salida'] }), item('pantalon', NEGRO, { occasions: ['formal', 'salida', 'casual'] }),
    item('short', GRIS, { occasions: ['deporte', 'casual'], season: 'verano' }),
    item('calzado', BLANCO, { occasions: ['casual', 'deporte'] }), item('calzado', NEGRO, { occasions: ['formal', 'salida'] }),
    item('abrigo', '#1f2a44', { season: 'invierno', occasions: ['casual', 'salida', 'formal'] }),
    item('accesorio', '#6b4a33', { occasions: ['casual', 'salida', 'formal'] }),
  ];
}

describe('suggestOutfit', () => {
  it('arma arriba + abajo + calzado', () => {
    const items = wardrobe();
    const r = suggestOutfit(items, { now: NOW, rng: seeded(3) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cats = r.itemIds.map((id) => items.find((i) => i.id === id)!.category);
    expect(cats.some((c) => c === 'remera' || c === 'camisa')).toBe(true);
    expect(cats.some((c) => c === 'pantalon' || c === 'short')).toBe(true);
    expect(cats).toContain('calzado');
    expect(r.reason.length).toBeGreaterThan(5);
  });

  it('con frío agrega abrigo y no usa prendas de verano', () => {
    const items = wardrobe();
    for (let s = 1; s < 30; s++) {
      const r = suggestOutfit(items, { now: NOW, weather: 'frio', rng: seeded(s) });
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      const list = r.itemIds.map((id) => items.find((i) => i.id === id)!);
      expect(list.some((i) => i.category === 'abrigo')).toBe(true);
      expect(list.every((i) => i.season !== 'verano')).toBe(true);
    }
  });

  it('con calor no sugiere abrigo', () => {
    const items = wardrobe();
    for (let s = 1; s < 30; s++) {
      const r = suggestOutfit(items, { now: NOW, weather: 'calor', rng: seeded(s) });
      if (!r.ok) continue;
      expect(r.itemIds.some((id) => id.startsWith('abrigo'))).toBe(false);
    }
  });

  it('respeta la ocasión y nunca mezcla formal con deporte', () => {
    const items = wardrobe();
    for (let s = 1; s < 50; s++) {
      const r = suggestOutfit(items, { now: NOW, rng: seeded(s) });
      if (!r.ok) continue;
      const list = r.itemIds.map((id) => items.find((i) => i.id === id)!);
      const hasFormalOnly = list.some((i) => i.occasions.includes('formal') && !i.occasions.includes('deporte') && !i.occasions.includes('casual'));
      const hasSportOnly = list.some((i) => i.occasions.length === 1 && i.occasions[0] === 'deporte');
      expect(hasFormalOnly && hasSportOnly).toBe(false);
    }
    for (let s = 1; s < 20; s++) {
      const r = suggestOutfit(items, { now: NOW, occasion: 'formal', rng: seeded(s) });
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      for (const id of r.itemIds) expect(items.find((i) => i.id === id)!.occasions).toContain('formal');
    }
  });

  it('nunca junta dos colores vivos distintos', () => {
    const items = wardrobe();
    for (let s = 1; s < 80; s++) {
      const r = suggestOutfit(items, { now: NOW, rng: seeded(s) });
      if (!r.ok) continue;
      expect(judgeColors(r.itemIds.map((id) => items.find((i) => i.id === id)!.color)).ok).toBe(true);
    }
  });

  it('"Otra idea" no repite lo ya mostrado mientras haya alternativas', () => {
    const items = wardrobe();
    const shown: string[] = [];
    for (let k = 0; k < 5; k++) {
      const r = suggestOutfit(items, { now: NOW, exclude: shown, rng: seeded(k + 7) });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(shown).not.toContain(r.signature);
      shown.push(r.signature);
    }
  });

  it('no repite un outfit usado en los últimos días', () => {
    const items = wardrobe();
    const first = suggestOutfit(items, { now: NOW, rng: seeded(11) });
    if (!first.ok) throw new Error();
    for (let s = 1; s < 30; s++) {
      const r = suggestOutfit(items, { now: NOW, rng: seeded(s), history: [{ itemIds: first.itemIds, wornAt: NOW - 2 * DAY }] });
      if (r.ok) expect(r.signature).not.toBe(first.signature);
    }
  });

  it('favorece prendas poco usadas', () => {
    const items = wardrobe().map((i) => (i.id === 'remera-1' ? i : { ...i, timesWorn: i.category === 'remera' ? 40 : i.timesWorn, lastWornAt: i.category === 'remera' ? NOW - DAY : null }));
    let hits = 0;
    for (let s = 1; s <= 200; s++) {
      const r = suggestOutfit(items, { now: NOW, rng: seeded(s) });
      if (r.ok && r.itemIds.includes('remera-1')) hits++;
    }
    expect(hits).toBeGreaterThan(70); // muy por encima del ~1/4 que tendría al azar
  });

  it('explica qué falta cuando no se puede armar', () => {
    const r = suggestOutfit([item('remera', NEGRO)], { now: NOW });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/pantalón/);
  });

  it('soporta muchos ítems rápido', () => {
    const big: Item[] = [];
    const hexes = [NEGRO, BLANCO, DENIM, GRIS, ROJO, VERDE, CELESTE, '#d8c3a5'];
    const cats: Category[] = ['remera', 'camisa', 'pantalon', 'short', 'calzado', 'abrigo', 'accesorio'];
    for (let k = 0; k < 300; k++) big.push(item(cats[k % cats.length], hexes[k % hexes.length]));
    const t = performance.now();
    const r = suggestOutfit(big, { now: NOW, weather: 'frio', rng: seeded(5) });
    expect(r.ok).toBe(true);
    expect(performance.now() - t).toBeLessThan(500);
  });
});
