import { CATEGORIES, FAMILIES, OCCASIONS, SEASONS, label } from '../constants';
import { classifyFamily } from '../lib/colorMath';
import type { Category, ItemColor, Occasion, Season } from '../types';
import { Chips } from './ui';

export interface Draft {
  category: Category | null;
  color: ItemColor;
  /** true si el usuario eligió el color a mano (no se pisa con el detectado). */
  colorTouched: boolean;
  season: Season;
  occasions: Occasion[];
  notes: string;
}

export const emptyDraft = (): Draft => ({
  category: null,
  color: { hex: '#8e8e93', family: 'gris' },
  colorTouched: false,
  season: 'todo',
  occasions: ['casual'],
  notes: '',
});

export function ItemForm({ draft, onChange, detected }: { draft: Draft; onChange: (fn: (d: Draft) => Draft) => void; detected?: ItemColor | null }) {
  // Actualización funcional: dos toques seguidos antes del re-render no se pisan.
  const set = (patch: Partial<Draft>) => onChange((d) => ({ ...d, ...patch }));
  return (
    <div class="form">
      <fieldset>
        <legend>Categoría <span class="req">*</span></legend>
        <Chips options={CATEGORIES} value={draft.category} onChange={(category) => set({ category })} />
      </fieldset>

      <fieldset>
        <legend>
          Color principal <span class="muted small">· {label.family(draft.color.family)}</span>
        </legend>
        <div class="swatches">
          {detected && (
            <button type="button" class={'swatch detected' + (draft.color.hex === detected.hex ? ' on' : '')} style={{ background: detected.hex }}
              title="Color detectado" aria-label={`Detectado: ${label.family(detected.family)}`}
              onClick={() => set({ color: detected, colorTouched: false })}>
              <span>auto</span>
            </button>
          )}
          {FAMILIES.map((f) => (
            <button type="button" key={f.id} class={'swatch' + (draft.color.family === f.id && draft.color.hex !== detected?.hex ? ' on' : '')}
              style={{ background: f.hex }} aria-label={f.label} title={f.label}
              onClick={() => set({ color: { hex: f.hex, family: f.id }, colorTouched: true })} />
          ))}
          <label class="swatch custom" title="Otro color" aria-label="Elegir otro color">
            <input type="color" value={draft.color.hex}
              onInput={(e) => {
                const hex = (e.target as HTMLInputElement).value;
                set({ color: { hex, family: classifyFamily(hex) }, colorTouched: true });
              }} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Estación</legend>
        <Chips options={SEASONS} value={draft.season} onChange={(season) => set({ season })} />
      </fieldset>

      <fieldset>
        <legend>Ocasión <span class="muted small">· podés elegir varias</span></legend>
        <Chips options={OCCASIONS} value={draft.occasions} multi onChange={(next: Occasion[]) => {
          // Aplica solo la ocasión tocada sobre el estado más reciente.
          const id = [...next.filter((o) => !draft.occasions.includes(o)), ...draft.occasions.filter((o) => !next.includes(o))][0];
          if (id) onChange((d) => ({ ...d, occasions: d.occasions.includes(id) ? d.occasions.filter((o) => o !== id) : [...d.occasions, id] }));
        }} />
      </fieldset>

      <fieldset>
        <legend>Notas <span class="muted small">· opcional</span></legend>
        <textarea rows={2} maxLength={300} placeholder="Ej: la de lino, me queda un poco grande" value={draft.notes}
          onInput={(e) => set({ notes: (e.target as HTMLTextAreaElement).value })} />
      </fieldset>
    </div>
  );
}
