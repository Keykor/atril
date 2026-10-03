import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { BackupFormatError } from '../../core/backup/atril';
import { backupDue, exportToFile, getLastBackupAt, importFromFile } from '../../core/backup/files';
import { firstDataAt } from '../../core/db/queries';
import { Icon } from '../../ui/Icon';
import { ago } from '../../ui/time';
import { t } from '../../app/strings';
import './settings.css';

const b = t.backup;

function useBackupState() {
  return useLiveQuery(async () => {
    const last = await getLastBackupAt();
    const first = await firstDataAt();
    return { last, due: backupDue(Date.now(), last, first) };
  }, []);
}

export function BackupCard() {
  const state = useBackupState();
  const [status, setStatus] = useState<string>();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const run = async (job: () => Promise<string | undefined>) => {
    setBusy(true);
    setStatus(b.working);
    try {
      setStatus(await job());
    } catch (e) {
      setStatus(e instanceof BackupFormatError ? b.badFile : b.failed);
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card pad">
      <h2>{b.title}</h2>
      <p>{b.intro}</p>
      <p>{state?.last ? b.last(ago(state.last)) : b.never}</p>
      <div className="row">
        <button
          className="btn"
          disabled={busy}
          onClick={() => run(async () => ((await exportToFile(false)) ? b.exported : undefined))}
        >
          <Icon name="download" size={18} />
          {b.exportAll}
        </button>
        <button
          className="btn"
          disabled={busy}
          onClick={() => run(async () => ((await exportToFile(true)) ? b.exported : undefined))}
        >
          <Icon name="download" size={18} />
          {b.exportLight}
        </button>
        <button className="btn" disabled={busy} onClick={() => input.current?.click()}>
          <Icon name="upload" size={18} />
          {b.import}
        </button>
        <input
          ref={input}
          type="file"
          accept=".atril,.zip,application/zip"
          hidden
          data-testid="backup-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file)
              void run(async () => {
                const r = await importFromFile(file);
                return b.imported(r.scores, r.pending);
              });
          }}
        />
      </div>
      <p>{b.lightHint}</p>
      {status && (
        <p role="status" className="status">
          {status}
        </p>
      )}
    </section>
  );
}

/** Recordatorio en la biblioteca cuando pasaron 7 días sin backup. */
export function BackupReminder({ suppressed }: { suppressed?: boolean }) {
  const state = useBackupState();
  if (!state?.due || suppressed) return null;
  return (
    <a className="reminder" href="#/settings">
      <Icon name="cloud" />
      <span>{b.reminder}</span>
      <Icon name="right" size={18} />
    </a>
  );
}
