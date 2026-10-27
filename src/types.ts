export type Category = 'remera' | 'camisa' | 'pantalon' | 'short' | 'abrigo' | 'calzado' | 'accesorio';
export type Season = 'verano' | 'entretiempo' | 'invierno' | 'todo';
export type Occasion = 'casual' | 'salida' | 'formal' | 'deporte';
export type Weather = 'frio' | 'templado' | 'calor';
export type ColorFamily =
  | 'negro' | 'blanco' | 'gris' | 'beige' | 'marino' | 'denim' | 'marron'
  | 'rojo' | 'naranja' | 'amarillo' | 'verde' | 'celeste' | 'azul' | 'violeta' | 'rosa';

export interface ItemColor {
  hex: string;
  family: ColorFamily;
}

/** Metadatos de una prenda. Las imágenes viven aparte (store `images`) para que listar sea liviano. */
export interface Item {
  id: string;
  category: Category;
  color: ItemColor;
  season: Season;
  occasions: Occasion[];
  notes: string;
  createdAt: number;
  timesWorn: number;
  lastWornAt: number | null;
  /** true si la imagen principal es el recorte; false si se usó la original. */
  bgRemoved: boolean;
  hasOriginal: boolean;
}

export type ImageKind = 'full' | 'thumb' | 'orig';

export interface Outfit {
  id: string;
  itemIds: string[];
  createdAt: number;
  favorite: boolean;
  wornDates: number[];
  reason: string;
}
