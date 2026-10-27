import { signal } from '@preact/signals';
import * as DB from './db/db';
import type { ImageKind, Item, Outfit } from './types';

export type Tab = 'armario' | 'agregar' | 'outfit' | 'stats';

export const items = signal<Item[]>([]);
export const outfits = signal<Outfit[]>([]);
export const loaded = signal(false);
export const tab = signal<Tab>(readTab());

function readTab(): Tab {
  const h = location.hash.slice(1);
  return (['armario', 'agregar', 'outfit', 'stats'] as const).includes(h as Tab) ? (h as Tab) : 'armario';
}
export function go(t: Tab) {
  tab.value = t;
  if (location.hash.slice(1) !== t) history.replaceState(null, '', '#' + t);
  window.scrollTo(0, 0);
}

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

// ---------- Toasts y confirmaciones ----------

export const toastMsg = signal<{ text: string; kind: 'info' | 'error'; key: number } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(text: string, kind: 'info' | 'error' = 'info') {
  toastMsg.value = { text, kind, key: Date.now() };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastMsg.value = null), kind === 'error' ? 5000 : 2600);
}

export function reportError(e: unknown, fallback = 'Algo salió mal') {
  console.error(e);
  toast(e instanceof DB.QuotaError ? e.message : `${fallback}. ${(e as Error)?.message ?? ''}`.trim(), 'error');
}

export const confirmState = signal<{ title: string; body?: string; ok: string; danger?: boolean; resolve: (v: boolean) => void } | null>(null);
export function confirmDialog(title: string, opts: { body?: string; ok?: string; danger?: boolean } = {}) {
  return new Promise<boolean>((resolve) => {
    confirmState.value = { title, body: opts.body, ok: opts.ok ?? 'Aceptar', danger: opts.danger, resolve };
  });
}

// ---------- URLs de imágenes (cacheadas en memoria) ----------

const urlCache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

export function imageUrl(id: string, kind: ImageKind): Promise<string | null> {
  const key = DB.imgKey(id, kind);
  const hit = urlCache.get(key);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(key);
  if (!p) {
    p = DB.getImage(id, kind).then((b) => {
      pending.delete(key);
      if (!b) return null;
      const url = URL.createObjectURL(b);
      urlCache.set(key, url);
      return url;
    });
    pending.set(key, p);
  }
  return p;
}
export const cachedImageUrl = (id: string, kind: ImageKind) => urlCache.get(DB.imgKey(id, kind)) ?? null;

function dropUrls(id: string) {
  for (const k of ['full', 'thumb', 'orig'] as ImageKind[]) {
    const key = DB.imgKey(id, k);
    const u = urlCache.get(key);
    if (u) URL.revokeObjectURL(u);
    urlCache.delete(key);
  }
}

// ---------- Acciones ----------

export async function loadAll() {
  const [i, o] = await Promise.all([DB.getAllItems(), DB.getAllOutfits()]);
  items.value = i.sort((a, b) => b.createdAt - a.createdAt);
  outfits.value = o.sort((a, b) => b.createdAt - a.createdAt);
  loaded.value = true;
}

export async function saveItem(item: Item, images?: Partial<Record<ImageKind, Blob | null>>) {
  await DB.putItem(item, images);
  if (images) dropUrls(item.id);
  const exists = items.value.some((i) => i.id === item.id);
  items.value = exists ? items.value.map((i) => (i.id === item.id ? item : i)) : [item, ...items.value];
}

export async function removeItem(id: string) {
  await DB.deleteItem(id);
  dropUrls(id);
  items.value = items.value.filter((i) => i.id !== id);
  const broken = outfits.value.filter((o) => o.itemIds.includes(id));
  await Promise.all(broken.map((o) => DB.deleteOutfit(o.id)));
  outfits.value = outfits.value.filter((o) => !o.itemIds.includes(id));
}

export async function wearItems(ids: string[], when = Date.now()) {
  const updated = items.value
    .filter((i) => ids.includes(i.id))
    .map((i) => ({ ...i, timesWorn: i.timesWorn + 1, lastWornAt: when }));
  await DB.putItemsMeta(updated);
  const byId = new Map(updated.map((i) => [i.id, i]));
  items.value = items.value.map((i) => byId.get(i.id) ?? i);
}

/** Busca un outfit guardado con exactamente esas prendas. */
export const findOutfit = (ids: string[]) => {
  const sig = [...ids].sort().join('|');
  return outfits.value.find((o) => [...o.itemIds].sort().join('|') === sig);
};

export async function upsertOutfit(ids: string[], reason: string, patch: (o: Outfit) => Outfit) {
  const base = findOutfit(ids) ?? { id: uid(), itemIds: ids, createdAt: Date.now(), favorite: false, wornDates: [], reason };
  const o = patch(base);
  await DB.putOutfit(o);
  const exists = outfits.value.some((x) => x.id === o.id);
  outfits.value = exists ? outfits.value.map((x) => (x.id === o.id ? o : x)) : [o, ...outfits.value];
  return o;
}

export async function deleteOutfitById(id: string) {
  await DB.deleteOutfit(id);
  outfits.value = outfits.value.filter((o) => o.id !== id);
}

export async function wipeAll() {
  await DB.clearAll();
  for (const u of urlCache.values()) URL.revokeObjectURL(u);
  urlCache.clear();
  items.value = [];
  outfits.value = [];
}
