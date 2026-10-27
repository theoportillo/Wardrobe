import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { cachedImageUrl, confirmState, imageUrl, toastMsg } from '../store';
import type { ImageKind } from '../types';

// ---------- Íconos ----------

const P = { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;
export const Icon = {
  hanger: () => (
    <svg viewBox="0 0 24 24" {...P}><path d="M12 7.5a2 2 0 1 1 2-2" /><path d="M12 7.5v1.2L3.2 15.4a1.5 1.5 0 0 0 .9 2.6h15.8a1.5 1.5 0 0 0 .9-2.6L12 8.7" /></svg>
  ),
  plus: () => (
    <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>
  ),
  sparkle: () => (
    <svg viewBox="0 0 24 24" {...P}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" /></svg>
  ),
  chart: () => (
    <svg viewBox="0 0 24 24" {...P}><path d="M4 20h16" /><rect x="6" y="11" width="3" height="6" rx="1" /><rect x="11" y="6" width="3" height="11" rx="1" /><rect x="16" y="9" width="3" height="8" rx="1" /></svg>
  ),
  camera: () => (
    <svg viewBox="0 0 24 24" {...P}><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></svg>
  ),
  image: () => (
    <svg viewBox="0 0 24 24" {...P}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>
  ),
  search: () => (
    <svg viewBox="0 0 24 24" {...P}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
  ),
  close: () => (
    <svg viewBox="0 0 24 24" {...P}><path d="M6 6l12 12M18 6L6 18" /></svg>
  ),
  star: ({ filled }: { filled?: boolean }) => (
    <svg viewBox="0 0 24 24" {...P} fill={filled ? 'currentColor' : 'none'}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" /></svg>
  ),
  filter: () => (
    <svg viewBox="0 0 24 24" {...P}><path d="M4 6h16M7 12h10M10 18h4" /></svg>
  ),
};

// ---------- Imagen con carga diferida ----------

let io: IntersectionObserver | null = null;
const ioCallbacks = new WeakMap<Element, () => void>();
function observe(el: Element, cb: () => void) {
  io ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io!.unobserve(e.target);
        ioCallbacks.get(e.target)?.();
        ioCallbacks.delete(e.target);
      }
    },
    { rootMargin: '300px' },
  );
  ioCallbacks.set(el, cb);
  io.observe(el);
  return () => { io?.unobserve(el); ioCallbacks.delete(el); };
}

export function ItemImage({ id, kind = 'thumb', lazy = true, alt = '', version }: { id: string; kind?: ImageKind; lazy?: boolean; alt?: string; version?: unknown }) {
  const [url, setUrl] = useState<string | null>(() => cachedImageUrl(id, kind));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    const cached = cachedImageUrl(id, kind);
    setUrl(cached);
    if (cached) return;
    const load = () => imageUrl(id, kind).then((u) => alive && setUrl(u));
    if (!lazy || !ref.current) { load(); return () => { alive = false; }; }
    const stop = observe(ref.current, load);
    return () => { alive = false; stop(); };
  }, [id, kind, version]);
  return (
    <div ref={ref} class={'img-box' + (url ? '' : ' loading')}>
      {url && <img src={url} alt={alt} decoding="async" draggable={false} />}
    </div>
  );
}

// ---------- Chips ----------

export function Chips<T extends string>({ options, value, onChange, multi, allowNone }: {
  options: { id: T; label: string }[];
  value: T[] | T | null;
  onChange: (v: any) => void;
  multi?: boolean;
  allowNone?: boolean;
}) {
  const sel = Array.isArray(value) ? value : value ? [value] : [];
  const toggle = (id: T) => {
    if (multi) onChange(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
    else onChange(sel.includes(id) && allowNone ? null : id);
  };
  return (
    <div class="chips">
      {options.map((o) => (
        <button type="button" key={o.id} class={'chip' + (sel.includes(o.id) ? ' on' : '')} aria-pressed={sel.includes(o.id)} onClick={() => toggle(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Hoja inferior (modal) ----------

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ComponentChildren; title?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll'); };
  }, [open]);
  if (!open) return null;
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div class="sheet-head">
          <span class="sheet-title">{title}</span>
          <button class="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon.close /></button>
        </div>
        <div class="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmHost() {
  const c = confirmState.value;
  if (!c) return null;
  const done = (v: boolean) => { confirmState.value = null; c.resolve(v); };
  return (
    <div class="sheet-backdrop center" onClick={(e) => e.target === e.currentTarget && done(false)}>
      <div class="dialog" role="alertdialog" aria-modal="true">
        <h3>{c.title}</h3>
        {c.body && <p class="muted">{c.body}</p>}
        <div class="row end">
          <button class="btn ghost" onClick={() => done(false)}>Cancelar</button>
          <button class={'btn ' + (c.danger ? 'danger' : 'primary')} onClick={() => done(true)}>{c.ok}</button>
        </div>
      </div>
    </div>
  );
}

export function ToastHost() {
  const t = toastMsg.value;
  if (!t) return null;
  return <div key={t.key} class={'toast ' + t.kind} role="status" onClick={() => (toastMsg.value = null)}>{t.text}</div>;
}

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ComponentChildren }) {
  return (
    <div class="empty">
      <div class="empty-emoji" aria-hidden="true">{emoji}</div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function Progress({ ratio, label }: { ratio: number | null; label: string }) {
  return (
    <div class="progress" role="progressbar" aria-valuenow={ratio == null ? undefined : Math.round(ratio * 100)} aria-label={label}>
      <div class="progress-label">{label}</div>
      <div class="progress-track"><div class={'progress-fill' + (ratio == null ? ' indeterminate' : '')} style={ratio == null ? undefined : { width: `${Math.round(ratio * 100)}%` }} /></div>
    </div>
  );
}
