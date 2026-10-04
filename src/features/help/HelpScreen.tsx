import { useState } from 'react';
import { resetHints } from '../../core/db/repos';
import { Icon } from '../../ui/Icon';
import { t } from '../../app/strings';
import './help.css';

interface Props {
  hints: { id: string; title: string }[];
  needsScore: string[]; // pistas que no se pueden mostrar sin una partitura importada
  onShow: (id: string) => void;
}

/** "Cómo se usa": las pistas de la app, cada una con "Mostrame" para verla en su lugar. */
export function HelpScreen({ hints, needsScore, onShow }: Props) {
  const h = t.help;
  const [reset, setReset] = useState(false);
  const blocked = (id: string) => needsScore.includes(id);

  return (
    <div className="help">
      <header className="screen-header">
        <h1>{h.title}</h1>
      </header>
      <p className="help-intro">{h.intro}</p>
      <ul className="help-list">
        {hints.map((hint) => (
          <li key={hint.id}>
            <span>
              <strong>{hint.title}</strong>
              {blocked(hint.id) && <small>{h.needScore}</small>}
            </span>
            <button
              className="btn"
              aria-label={h.showOne(hint.title)}
              disabled={blocked(hint.id)}
              onClick={() => onShow(hint.id)}
            >
              <Icon name="play" size={16} />
              {h.show}
            </button>
          </li>
        ))}
      </ul>
      <div className="help-reset">
        <button
          className="btn ghost"
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
