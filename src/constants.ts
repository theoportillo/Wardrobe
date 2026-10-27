import type { Category, ColorFamily, Occasion, Season, Weather } from './types';

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'remera', label: 'Remera' },
  { id: 'camisa', label: 'Camisa / buzo' },
  { id: 'pantalon', label: 'Pantalón' },
  { id: 'short', label: 'Short / pollera' },
  { id: 'abrigo', label: 'Abrigo' },
  { id: 'calzado', label: 'Calzado' },
  { id: 'accesorio', label: 'Accesorio' },
];

export const SEASONS: { id: Season; label: string }[] = [
  { id: 'verano', label: 'Verano' },
  { id: 'entretiempo', label: 'Entretiempo' },
  { id: 'invierno', label: 'Invierno' },
  { id: 'todo', label: 'Todo el año' },
];

export const OCCASIONS: { id: Occasion; label: string }[] = [
  { id: 'casual', label: 'Casual' },
  { id: 'salida', label: 'Salida' },
  { id: 'formal', label: 'Formal' },
  { id: 'deporte', label: 'Deporte' },
];

export const WEATHERS: { id: Weather; label: string }[] = [
  { id: 'frio', label: '🥶 Frío' },
  { id: 'templado', label: '🌤️ Templado' },
  { id: 'calor', label: '☀️ Calor' },
];

/** Familias de color con un hex representativo (para el selector manual). */
export const FAMILIES: { id: ColorFamily; label: string; hex: string }[] = [
  { id: 'negro', label: 'Negro', hex: '#1c1c1e' },
  { id: 'blanco', label: 'Blanco', hex: '#f5f5f2' },
  { id: 'gris', label: 'Gris', hex: '#8e8e93' },
  { id: 'beige', label: 'Beige', hex: '#d8c3a5' },
  { id: 'marino', label: 'Azul marino', hex: '#1f2a44' },
  { id: 'denim', label: 'Denim', hex: '#4a6587' },
  { id: 'marron', label: 'Marrón', hex: '#6b4a33' },
  { id: 'rojo', label: 'Rojo', hex: '#c0392b' },
  { id: 'naranja', label: 'Naranja', hex: '#e67e22' },
  { id: 'amarillo', label: 'Amarillo', hex: '#f1c40f' },
  { id: 'verde', label: 'Verde', hex: '#3a8a4f' },
  { id: 'celeste', label: 'Celeste', hex: '#7ec8e3' },
  { id: 'azul', label: 'Azul', hex: '#2e6bd1' },
  { id: 'violeta', label: 'Violeta', hex: '#7d4cb3' },
  { id: 'rosa', label: 'Rosa', hex: '#e58fb1' },
];

export const label = {
  category: (id: Category) => CATEGORIES.find((c) => c.id === id)?.label ?? id,
  season: (id: Season) => SEASONS.find((s) => s.id === id)?.label ?? id,
  occasion: (id: Occasion) => OCCASIONS.find((o) => o.id === id)?.label ?? id,
  family: (id: ColorFamily) => FAMILIES.find((f) => f.id === id)?.label ?? id,
};

export const DAY = 24 * 60 * 60 * 1000;
export const FORGOTTEN_DAYS = 60;
