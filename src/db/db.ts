import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ImageKind, Item, Outfit } from '../types';

interface ArmarioDB extends DBSchema {
  items: { key: string; value: Item };
  /** key = `${itemId}:${kind}` */
  images: { key: string; value: Blob };
  outfits: { key: string; value: Outfit };
  meta: { key: string; value: unknown };
}

let dbp: Promise<IDBPDatabase<ArmarioDB>> | null = null;

export function db() {
  dbp ??= openDB<ArmarioDB>('armario', 1, {
    upgrade(d) {
      d.createObjectStore('items', { keyPath: 'id' });
      d.createObjectStore('images');
      d.createObjectStore('outfits', { keyPath: 'id' });
      d.createObjectStore('meta');
    },
  });
  return dbp;
}

export const imgKey = (id: string, kind: ImageKind) => `${id}:${kind}`;

export class QuotaError extends Error {
  constructor() {
    super('No hay más espacio en el dispositivo para guardar fotos. Liberá espacio o borrá prendas que no uses.');
  }
}

function wrapQuota(e: unknown): never {
  const name = (e as DOMException)?.name;
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') throw new QuotaError();
  throw e;
}

export async function getAllItems() {
  return (await db()).getAll('items');
}

export async function getAllOutfits() {
  return (await db()).getAll('outfits');
}

export async function putItem(item: Item, images?: Partial<Record<ImageKind, Blob | null>>) {
  try {
    const tx = (await db()).transaction(['items', 'images'], 'readwrite');
    const ops: Promise<unknown>[] = [tx.objectStore('items').put(item)];
    for (const [kind, blob] of Object.entries(images ?? {})) {
      const key = imgKey(item.id, kind as ImageKind);
      ops.push(blob ? tx.objectStore('images').put(blob, key) : tx.objectStore('images').delete(key));
    }
    await Promise.all([...ops, tx.done]);
  } catch (e) {
    wrapQuota(e);
  }
}

export async function putItemsMeta(items: Item[]) {
  const tx = (await db()).transaction('items', 'readwrite');
  await Promise.all([...items.map((i) => tx.store.put(i)), tx.done]);
}

export async function deleteItem(id: string) {
  const tx = (await db()).transaction(['items', 'images'], 'readwrite');
  const imgs = tx.objectStore('images');
  await Promise.all([
    tx.objectStore('items').delete(id),
    imgs.delete(imgKey(id, 'full')),
    imgs.delete(imgKey(id, 'thumb')),
    imgs.delete(imgKey(id, 'orig')),
    tx.done,
  ]);
}

export async function getImage(id: string, kind: ImageKind) {
  return (await db()).get('images', imgKey(id, kind));
}

export async function putOutfit(o: Outfit) {
  try {
    await (await db()).put('outfits', o);
  } catch (e) {
    wrapQuota(e);
  }
}

export async function deleteOutfit(id: string) {
  await (await db()).delete('outfits', id);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db()).get('meta', key) as Promise<T | undefined>;
}

export async function setMeta(key: string, value: unknown) {
  await (await db()).put('meta', value, key);
}

export async function clearAll() {
  const tx = (await db()).transaction(['items', 'images', 'outfits', 'meta'], 'readwrite');
  await Promise.all([
    tx.objectStore('items').clear(),
    tx.objectStore('images').clear(),
    tx.objectStore('outfits').clear(),
    tx.objectStore('meta').clear(),
    tx.done,
  ]);
}

/** Todas las imágenes, para el respaldo. */
export async function getAllImages(): Promise<[string, Blob][]> {
  const d = await db();
  const [keys, vals] = await Promise.all([d.getAllKeys('images'), d.getAll('images')]);
  return keys.map((k, i) => [k, vals[i]]);
}

export async function importAll(items: Item[], outfits: Outfit[], images: [string, Blob][]) {
  try {
    const tx = (await db()).transaction(['items', 'images', 'outfits'], 'readwrite');
    const ops: Promise<unknown>[] = [];
    for (const i of items) ops.push(tx.objectStore('items').put(i));
    for (const o of outfits) ops.push(tx.objectStore('outfits').put(o));
    for (const [k, b] of images) ops.push(tx.objectStore('images').put(b, k));
    await Promise.all([...ops, tx.done]);
  } catch (e) {
    wrapQuota(e);
  }
}
