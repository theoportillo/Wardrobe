import { DAY } from '../constants';

export function daysSince(ts: number, now = Date.now()) {
  return Math.floor((startOfDay(now) - startOfDay(ts)) / DAY);
}

export function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function relDay(ts: number | null, now = Date.now()) {
  if (ts == null) return 'nunca';
  const d = daysSince(ts, now);
  if (d <= 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d < 30) return `hace ${d} días`;
  if (d < 60) return 'hace un mes';
  if (d < 365) return `hace ${Math.floor(d / 30)} meses`;
  return 'hace más de un año';
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function formatBytes(b: number) {
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
