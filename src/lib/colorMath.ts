import type { ColorFamily } from '../types';

export interface HSL { h: number; s: number; l: number } // h 0-360, s/l 0-1

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

export const hexToHsl = (hex: string) => rgbToHsl(...hexToRgb(hex));

/** Clasifica un color en una familia "de placard" (no puramente cromática: denim, beige, marino...). */
export function classifyFamily(hex: string): ColorFamily {
  const { h, s, l } = hexToHsl(hex);
  if (l < 0.13) return 'negro';
  if (l > 0.9 && s < 0.5) return 'blanco';
  if (s < 0.12 || (s < 0.2 && l > 0.25 && l < 0.8 && !(h > 20 && h < 60))) {
    if (l < 0.2) return 'negro';
    if (l > 0.84) return 'blanco';
    return 'gris';
  }
  if (h >= 195 && h <= 250) {
    if (l < 0.28) return 'marino';
    if (s < 0.5 && l < 0.65) return 'denim';
  }
  if (h >= 15 && h <= 55) {
    if (l < 0.42 && s < 0.75) return 'marron';
    if (l > 0.6 && s < 0.6) return 'beige';
  }
  if (h >= 180 && h < 240 && l > 0.62) return 'celeste';
  if (h < 12 || h >= 345) return l > 0.7 ? 'rosa' : 'rojo';
  if (h < 40) return 'naranja';
  if (h < 66) return 'amarillo';
  if (h < 170) return 'verde';
  if (h < 205) return 'celeste';
  if (h < 255) return 'azul';
  if (h < 295) return 'violeta';
  return 'rosa';
}

export const NEUTRALS: ReadonlySet<ColorFamily> = new Set(['negro', 'blanco', 'gris', 'beige', 'marino', 'denim', 'marron']);

/** Un color "vivo" es no neutro y suficientemente saturado (no pastel, no apagado). */
export function isVivid(family: ColorFamily, hex: string): boolean {
  if (NEUTRALS.has(family)) return false;
  const { s, l } = hexToHsl(hex);
  return s >= 0.45 && l >= 0.25 && l <= 0.72;
}

export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
