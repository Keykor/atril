import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { getLastBackupAt } from '../../core/backup/files';
import {
  backupToDriveNow,
  connectDrive,
  disconnectDrive,
  driveConfigured,
  getDriveState,
  listDriveBackups,
  restoreFromDrive,
  type DriveBackup,
} from '../../core/backup/drive';
import { language } from '../../core/language';
import { Icon } from '../../ui/Icon';
import { ago } from '../../ui/time';
import { t } from '../../app/strings';
import './settings.css';

const d = t.drive;

export const useDriveState = () => useLiveQuery(getDriveState, []);

export function DriveCard() {
  const state = useDriveState();
  const [status, setStatus] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [backups, setBackups] = useState<DriveBackup[]>();

  const run = async (job: () => Promise<string | undefined>) => {
    setBusy(true);
    setStatus(t.backup.working);
    try {
      setStatus(await job());
    } catch (e) {
      console.error(e);
      setStatus(d.failed);
    } finally {
      setBusy(false);
    }
  };

  if (!driveConfigured)
    return (
      <section className="card pad" aria-disabled="true">
        <h2>{d.title}</h2>
        <p>{d.notConfigured}</p>
      </section>
    );

  return (
    <section className="card pad">
      <h2>{d.title}</h2>
      <p>{d.intro}</p>
      {state?.connected ? (
        <>
          <p>
            {state.error === 'auth'
              ? d.needsReconnect
              : state.error
                ? d.uploadFailed
                : state.lastUploadAt
                  ? d.lastUpload(ago(state.lastUploadAt))
                  : d.connectedNoUpload}
          </p>
          <div className="row">
            {state.error === 'auth' && (
              <button className="btn primary" disabled={busy} onClick={() => run(reconnect)}>
                {d.reconnect}
              </button>
            )}
            <button
              className="btn"
              disabled={busy}
              onClick={() => run(async () => (await backupToDriveNow(), d.uploaded))}
            >
              <Icon name="upload" size={18} />
              {d.uploadNow}
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() => run(async () => (setBackups(await listDriveBackups()), undefined))}
            >
              <Icon name="download" size={18} />
              {d.restore}
            </button>
            <button className="btn ghost" disabled={busy} onClick={() => run(disconnect)}>
              {d.disconnect}
            </button>
          </div>
          {backups && (
            <ul className="drive-backups" aria-label={d.pick}>
              {backups.length === 0 && <li>{d.noBackups}</li>}
              {backups.map((b) => (
                <li key={b.id}>
                  <span>
                    {b.name}
                    <small>{new Date(b.modifiedTime).toLocaleString(language)}</small>
                  </span>
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const r = await restoreFromDrive(b.id);
                        setBackups(undefined);
                        return t.backup.imported(r.scores, r.pending);
                      })
                    }
                  >
                    {d.restoreThis}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={() => run(reconnect)}>
            <Icon name="cloud" size={18} />
            {d.connect}
          </button>
        </div>
      )}
      {status && (
        <p role="status" className="status">
          {status}
        </p>
      )}
    </section>
  );
}

async function reconnect() {
  await connectDrive();
  await backupToDriveNow();
  return d.uploaded;
}
async function disconnect() {
  await disconnectDrive();
  return undefined;
}

/** Estado del backup al pie de la barra lateral, como en el diseño. */
export function BackupStatus() {
  const drive = useDriveState();
  const last = useLiveQuery(getLastBackupAt, []);
  const onDrive = !!drive?.connected;
  const state = onDrive ? (drive.error ? 'error' : 'ok') : 'local';
  return (
    <div className="backup-status" data-state={state}>
      <strong>
        <Icon name="cloud" size={18} />
        {onDrive ? d.sidebarTitle : t.backup.sidebarTitle}
      </strong>
      <span>
        {onDrive && drive.error
          ? drive.error === 'auth'
            ? d.needsReconnect
            : d.uploadFailed
          : (onDrive ? drive.lastUploadAt : last)
            ? t.backup.sidebarLast(ago((onDrive ? drive.lastUploadAt : last)!))
            : t.backup.sidebarNever}
      </span>
      <a href="#/settings">{onDrive && drive.error ? d.reconnect : t.backup.sidebarExport}</a>
    </div>
  );
}
