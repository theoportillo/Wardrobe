import { signal } from '@preact/signals';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { DAY } from './constants';
import * as DB from './db/db';
import { loadAll } from './store';
import type { Item, Outfit } from './types';

const FORMAT = 'armario-backup';
const VERSION = 1;
const REMIND_EVERY = 14 * DAY;

export const lastExportAt = signal<number | null>(null);
export const snoozedUntil = signal<number>(0);

export async function loadBackupMeta() {
  lastExportAt.value = (await DB.getMeta<number>('lastExportAt')) ?? null;
  snoozedUntil.value = (await DB.getMeta<number>('backupSnoozedUntil')) ?? 0;
}

/** Hay que recordar si hay prendas nuevas/cambios desde el último respaldo y pasó el intervalo. */
export function backupDue(items: Item[], now = Date.now()) {
  if (!items.length || now < snoozedUntil.value) return false;
  const last = lastExportAt.value;
  if (last == null) return now - Math.min(...items.map((i) => i.createdAt)) > 3 * DAY || items.length >= 15;
  const changedSince = items.some((i) => i.createdAt > last || (i.lastWornAt ?? 0) > last);
  return changedSince && now - last > REMIND_EVERY;
}

export async function snoozeBackup(days = 3) {
  snoozedUntil.value = Date.now() + days * DAY;
  await DB.setMeta('backupSnoozedUntil', snoozedUntil.value);
}

const ext = (type: string) => (type.includes('webp') ? 'webp' : type.includes('png') ? 'png' : 'jpg');
const mimeOf = (name: string) => (name.endsWith('.webp') ? 'image/webp' : name.endsWith('.png') ? 'image/png' : 'image/jpeg');

/** Arma un .zip con data.json + todas las imágenes (sin recomprimir: ya están comprimidas). */
export async function buildBackup(): Promise<File> {
  const [items, outfits, images] = await Promise.all([DB.getAllItems(), DB.getAllOutfits(), DB.getAllImages()]);
  const files: Zippable = {};
  const imageIndex: Record<string, string> = {};
  for (const [key, blob] of images) {
    const name = `images/${key.replace(':', '_')}.${ext(blob.type)}`;
    files[name] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
    imageIndex[key] = name;
  }
  const data = { format: FORMAT, version: VERSION, exportedAt: Date.now(), items, outfits, images: imageIndex };
  files['data.json'] = strToU8(JSON.stringify(data, null, 1));
  const zipped = zipSync(files);
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return new File([zipped as BlobPart], `armario-${stamp}.zip`, { type: 'application/zip' });
}

/** Comparte (celular) o descarga el respaldo. Devuelve false si el usuario canceló. */
export async function exportBackup(): Promise<boolean> {
  const file = await buildBackup();
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  let done = false;
  if (nav.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try {
      await nav.share({ files: [file], title: 'Respaldo de mi armario' });
      done = true;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return false;
      // Si compartir falla por otro motivo, caemos a la descarga.
    }
  }
  if (!done) {
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  lastExportAt.value = Date.now();
  await DB.setMeta('lastExportAt', lastExportAt.value);
  return true;
}

export interface ParsedBackup {
  items: Item[];
  outfits: Outfit[];
  images: [string, Blob][];
  exportedAt: number;
}

export async function parseBackup(file: File): Promise<ParsedBackup> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error('El archivo no es un respaldo válido (.zip).');
  }
  if (!entries['data.json']) throw new Error('Al respaldo le falta data.json.');
  const data = JSON.parse(strFromU8(entries['data.json']));
  if (data.format !== FORMAT || !Array.isArray(data.items)) throw new Error('Este archivo no es un respaldo de Mi Armario.');
  if (data.version > VERSION) throw new Error('El respaldo es de una versión más nueva de la app. Actualizala primero.');
  const images: [string, Blob][] = [];
  for (const [key, name] of Object.entries<string>(data.images ?? {})) {
    const bytes = entries[name];
    if (bytes) images.push([key, new Blob([bytes as BlobPart], { type: mimeOf(name) })]);
  }
  return { items: data.items, outfits: data.outfits ?? [], images, exportedAt: data.exportedAt };
}

export async function importBackup(b: ParsedBackup) {
  await DB.importAll(b.items, b.outfits, b.images);
  await loadAll();
}
