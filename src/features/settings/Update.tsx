import { useState, useSyncExternalStore } from 'react';
import {
  applyUpdate,
  checkForUpdate,
  dismissUpdate,
  hasUpdate,
  onUpdateChange,
  showUpdateBanner,
} from '../../core/update';
import { language } from '../../core/language';
import { Icon } from '../../ui/Icon';
import { t } from '../../app/strings';
import './settings.css';

const u = t.update;
const useUpdate = () => useSyncExternalStore(onUpdateChange, hasUpdate);

const buildDate = new Date(__BUILD_DATE__).toLocaleString(language, {
  dateStyle: 'long',
  timeStyle: 'short',
});

/** Aviso de versión nueva. No aparece dentro del lector: ahí no se interrumpe. */
export function UpdateBanner() {
  if (!useSyncExternalStore(onUpdateChange, showUpdateBanner)) return null;
  return (
    <div className="reminder info update-banner" role="status">
      <Icon name="download" />
      <span>{u.available}</span>
      <button className="btn primary" onClick={() => void applyUpdate()}>
        {u.apply}
      </button>
      <button className="icon-btn" aria-label={u.later} onClick={dismissUpdate}>
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

/** Versión instalada en Ajustes, con el botón de actualizar si hay una nueva esperando. */
export function VersionCard() {
  const available = useUpdate();
  const [check, setCheck] = useState<'checking' | 'latest' | 'found' | 'offline'>();
  return (
    <section className="card pad">
      <h2>{u.title}</h2>
      <p>{u.version(__APP_VERSION__, buildDate, __BUILD_SHA__)}</p>
      {available ? (
        <div className="row">
          <button className="btn primary" onClick={() => void applyUpdate()}>
            <Icon name="download" size={18} />
            {u.apply}
          </button>
        </div>
      ) : (
        <>
          <p aria-live="polite">
            {check === 'latest'
              ? u.latest
              : check === 'found'
                ? u.found
                : check === 'offline'
                  ? u.offline
                  : u.upToDate}
          </p>
          <div className="row">
            <button
              className="btn"
              disabled={check === 'checking'}
              onClick={async () => {
                setCheck('checking');
                const found = await checkForUpdate();
                setCheck(found === undefined ? 'offline' : found ? 'found' : 'latest');
              }}
            >
              {check === 'checking' ? u.checking : u.check}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
