import { hexToHsl, hueDistance, isVivid, NEUTRALS } from '../lib/colorMath';
import { label } from '../constants';
import type { ItemColor } from '../types';

export type Harmony = 'neutral' | 'accent' | 'monochrome' | 'analogous' | 'complementary';

export interface ColorVerdict {
  ok: boolean;
  harmony: Harmony;
  /** Frase corta para la explicación. */
  text: string;
  bonus: number;
}

const ANALOGOUS_MAX = 45;
const COMPLEMENT_MIN = 150;

/**
 * Reglas:
 * - Neutros (negro, blanco, gris, beige, marino, denim, marrón) combinan con todo.
 * - Máximo un color vivo por outfit.
 * - Los colores no neutros entre sí tienen que ser de la misma familia, análogos (≤45° en la rueda HSL)
 *   o complementarios (≥150°).
 */
export function judgeColors(colors: ItemColor[]): ColorVerdict {
  const colored = colors.filter((c) => !NEUTRALS.has(c.family));
  const vivid = colored.filter((c) => isVivid(c.family, c.hex));
  if (vivid.length > 1) {
    const sameFamily = vivid.every((v) => v.family === vivid[0].family);
    if (!sameFamily) return { ok: false, harmony: 'accent', text: 'Demasiados colores vivos', bonus: 0 };
  }

  if (colored.length === 0) {
    const fams = [...new Set(colors.map((c) => label.family(c.family).toLowerCase()))];
    const text = fams.length === 1 ? `Total look ${fams[0]}: simple y prolijo` : `Todo neutro (${listEs(fams.slice(0, 3))}): no falla`;
    return { ok: true, harmony: 'neutral', text, bonus: 0.15 };
  }

  const families = [...new Set(colored.map((c) => c.family))];
  if (families.length === 1) {
    const fam = label.family(families[0]).toLowerCase();
    return colored.length === 1
      ? { ok: true, harmony: 'accent', text: `Base neutra + un acento ${fam}`, bonus: 0.35 }
      : { ok: true, harmony: 'monochrome', text: `Base neutra con tonos de ${fam}`, bonus: 0.3 };
  }

  let worst: 'analogous' | 'complementary' = 'analogous';
  for (let i = 0; i < colored.length; i++) {
    for (let j = i + 1; j < colored.length; j++) {
      if (colored[i].family === colored[j].family) continue;
      const d = hueDistance(hexToHsl(colored[i].hex).h, hexToHsl(colored[j].hex).h);
      if (d <= ANALOGOUS_MAX) continue;
      if (d >= COMPLEMENT_MIN) { worst = 'complementary'; continue; }
      return { ok: false, harmony: 'analogous', text: 'Colores que chocan', bonus: 0 };
    }
  }
  // Tres colores distintos con contraste complementario ya es mucho.
  if (worst === 'complementary' && families.length > 2) return { ok: false, harmony: 'complementary', text: 'Demasiado contraste', bonus: 0 };
  const names = listEs(families.map((f) => label.family(f).toLowerCase()));
  return worst === 'complementary'
    ? { ok: true, harmony: 'complementary', text: `Contraste complementario: ${names}`, bonus: 0.4 }
    : { ok: true, harmony: 'analogous', text: `Tonos análogos (${names}) sobre base neutra`, bonus: 0.35 };
}

function listEs(xs: string[]) {
  if (xs.length <= 1) return xs.join('');
  return xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1];
}
