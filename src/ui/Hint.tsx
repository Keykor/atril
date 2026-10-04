import './ui.css';

interface Props {
  title: string;
  text: string;
  doneLabel: string;
  onDone: () => void;
  top?: boolean; // arriba, para no tapar un panel de abajo (ensayo)
}

/** Pista de una sola vez: un texto corto y "Entendido". */
export function Hint({ title, text, doneLabel, onDone, top }: Props) {
  return (
    <aside
      className={`hint${top ? ' top' : ''}`}
      role="dialog"
      aria-label={title}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <h2>{title}</h2>
      <p>{text}</p>
      <footer>
        <button className="btn primary" onClick={onDone}>
          {doneLabel}
        </button>
      </footer>
    </aside>
  );
}
