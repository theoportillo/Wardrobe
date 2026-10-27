import { ConfirmHost, Icon, ToastHost } from './components/ui';
import { Agregar } from './screens/Agregar';
import { Armario } from './screens/Armario';
import { Outfit } from './screens/Outfit';
import { Stats } from './screens/Stats';
import { go, tab, type Tab } from './store';

const TABS: { id: Tab; label: string; icon: () => preact.JSX.Element }[] = [
  { id: 'armario', label: 'Armario', icon: Icon.hanger },
  { id: 'agregar', label: 'Agregar', icon: Icon.plus },
  { id: 'outfit', label: 'Outfit', icon: Icon.sparkle },
  { id: 'stats', label: 'Stats', icon: Icon.chart },
];

export function App() {
  const t = tab.value;
  return (
    <>
      <main>
        {/* Agregar queda montado para no perder una foto a medio recortar si cambiás de pestaña. */}
        <div hidden={t !== 'agregar'}><Agregar /></div>
        {t === 'armario' && <Armario />}
        {t === 'outfit' && <Outfit />}
        {t === 'stats' && <Stats />}
      </main>
      <nav class="tabbar" aria-label="Secciones">
        {TABS.map((x) => (
          <button key={x.id} class={'tab' + (t === x.id ? ' on' : '') + (x.id === 'agregar' ? ' add' : '')} aria-current={t === x.id ? 'page' : undefined} onClick={() => go(x.id)}>
            <x.icon />
            <span>{x.label}</span>
          </button>
        ))}
      </nav>
      <ToastHost />
      <ConfirmHost />
    </>
  );
}
