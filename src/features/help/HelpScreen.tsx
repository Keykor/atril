import { useEffect, useState } from 'react';
import { resetHints } from '../../core/db/repos';
import { t } from '../../app/strings';
import './help.css';

/** "Cómo se usa": todas las funciones explicadas, por sección. */
export function HelpScreen({ section }: { section?: string }) {
  const h = t.help;
  const [reset, setReset] = useState(false);

  useEffect(() => {
    if (section) document.getElementById(`help-${section}`)?.scrollIntoView();
  }, [section]);

  return (
    <div className="help">
      <header className="screen-header">
        <h1>{h.title}</h1>
      </header>
      {h.sections.map((s) => (
        <section key={s.id} id={`help-${s.id}`} className="help-section">
          <h2>{s.title}</h2>
          <ul>
            {s.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
      <div className="help-reset">
        <button
          className="btn"
          onClick={async () => {
            await resetHints();
            setReset(true);
          }}
        >
          {h.reset}
        </button>
        {reset && <p role="status">{h.resetDone}</p>}
      </div>
    </div>
  );
}

/** Acceso desde Ajustes. */
export function HelpCard() {
  return (
    <section className="card pad">
      <h2>{t.help.title}</h2>
      <p>{t.help.cardText}</p>
      <a className="btn help-open" href="#/help">
        {t.help.open}
      </a>
    </section>
  );
}
