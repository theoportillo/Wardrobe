import type { Category, Item } from '../types';
import { ItemImage } from './ui';

const AREA: Record<Category, string> = {
  remera: 'top', camisa: 'top', pantalon: 'bottom', short: 'bottom', abrigo: 'outer', calzado: 'shoes', accesorio: 'acc',
};

/** Collage tipo "flat lay": arriba y abajo grandes a la izquierda, abrigo/calzado/accesorio a la derecha. */
export function Collage({ items, small }: { items: Item[]; small?: boolean }) {
  return (
    <div class={'collage' + (small ? ' small' : '')}>
      {items.map((i) => (
        <div key={i.id} class={'collage-cell ' + AREA[i.category] + (i.bgRemoved ? '' : ' photo')}>
          <ItemImage id={i.id} kind={small ? 'thumb' : 'full'} lazy={small} version={i} />
        </div>
      ))}
    </div>
  );
}
