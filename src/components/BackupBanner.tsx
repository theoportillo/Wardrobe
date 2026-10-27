import { useState } from 'preact/hooks';
import { backupDue, exportBackup, lastExportAt, snoozeBackup } from '../backup';
import { relDay } from '../lib/format';
import { items, reportError, toast } from '../store';

export function BackupBanner() {
  const [busy, setBusy] = useState(false);
  if (!backupDue(items.value)) return null;
  const last = lastExportAt.value;
  return (
    <div class="banner">
      <div>
        <strong>Hacé un respaldo</strong>
        <p class="small">{last ? `El último fue ${relDay(last)}.` : 'Todavía no exportaste tus prendas.'} Si borrás los datos del navegador o cambiás de celu, se pierden.</p>
      </div>
      <div class="row">
        <button class="btn ghost small" onClick={() => snoozeBackup()}>Después</button>
        <button class="btn primary small" disabled={busy} onClick={async () => {
          setBusy(true);
          try { if (await exportBackup()) toast('Respaldo exportado'); } catch (e) { reportError(e, 'No se pudo exportar'); }
          setBusy(false);
        }}>{busy ? 'Armando…' : 'Exportar'}</button>
      </div>
    </div>
  );
}
