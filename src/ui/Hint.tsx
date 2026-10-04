import './ui.css';

interface Props {
  title: string;
  text: string;
  doneLabel: string;
  moreLabel: string;
  moreHref: string; // sección de "Cómo se usa"
  onDone: () => void;
}

/** Pista de una sola vez: un texto corto, "Entendido" y un link a la explicación completa. */
export function Hint({ title, text, doneLabel, moreLabel, moreHref, onDone }: Props) {
  return (
    <aside
      className="hint"
      role="dialog"
      aria-label={title}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <h2>{title}</h2>
      <p>{text}</p>
      <footer>
        <a className="btn ghost" href={moreHref} onClick={onDone}>
          {moreLabel}
        </a>
        <button className="btn primary" onClick={onDone}>
          {doneLabel}
        </button>
      </footer>
    </aside>
  );
}
