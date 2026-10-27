import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { loadBackupMeta } from './backup';
import { go, loadAll, reportError, tab, type Tab } from './store';
import './styles.css';

render(<App />, document.getElementById('app')!);

loadAll().catch((e) => reportError(e, 'No pude abrir la base de datos del armario'));
loadBackupMeta().catch(() => {});

// Pide que el navegador no borre los datos por falta de espacio (Chrome lo concede a PWAs instaladas / sitios usados seguido).
navigator.storage?.persist?.().catch(() => {});

window.addEventListener('hashchange', () => {
  const h = location.hash.slice(1) as Tab;
  if (h && h !== tab.value) go(h);
});

registerSW({ immediate: true });
