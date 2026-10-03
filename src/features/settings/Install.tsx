import { useLiveQuery } from 'dexie-react-hooks';
import { useSyncExternalStore } from 'react';
import {
  canPromptInstall,
  isIOS,
  isStandalone,
  onInstallChange,
  promptInstall,
} from '../../core/install';
import { getSetting, setSetting } from '../../core/db/repos';
import { Icon } from '../../ui/Icon';
import { t } from '../../app/strings';
import './settings.css';

const i = t.install;

/** Cómo instalar la app. En iOS no hay botón: se explica "Agregar a inicio". */
export function InstallCard() {
  const canPrompt = useSyncExternalStore(onInstallChange, canPromptInstall);
  if (isStandalone())
    return (
      <section className="card pad">
        <h2>{i.title}</h2>
        <p>{i.installed}</p>
      </section>
    );
  return (
    <section className="card pad">
      <h2>{i.title}</h2>
      <p>{i.why}</p>
      {isIOS() ? (
        <ol className="install-steps">
          {i.iosSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : canPrompt ? (
        <div className="row">
          <button className="btn primary" onClick={() => void promptInstall()}>
            <Icon name="download" size={18} />
            {i.install}
          </button>
        </div>
      ) : (
        <p>{i.other}</p>
      )}
    </section>
  );
}

/** En la biblioteca: conviene instalar antes de importar (en iOS el storage no se comparte). */
export function InstallBanner() {
  const dismissed = useLiveQuery(() => getSetting('installBannerDismissed', false), []);
  if (isStandalone() || dismissed !== false) return null;
  return (
    <div className="reminder info">
      <a href="#/settings">
        <Icon name="download" />
        <span>{i.banner}</span>
      </a>
      <button
        className="icon-btn"
        aria-label={i.dismiss}
        onClick={() => void setSetting('installBannerDismissed', true)}
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
