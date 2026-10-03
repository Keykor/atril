import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../core/db/db';
import { addBookmark } from '../../core/db/repos';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { t } from '../../app/strings';

const b = t.bookmarks;

interface Props {
  scoreId: string;
  currentPage: number; // página real a la vista
  onJump: (page: number) => void;
  onClose: () => void;
}

/** Marcadores: letras de ensayo o compases con nombre, para saltar en dos toques. */
export function BookmarksSheet({ scoreId, currentPage, onJump, onClose }: Props) {
  const bookmarks = useLiveQuery(
    async () =>
      (await db.bookmarks.where('scoreId').equals(scoreId).toArray()).sort(
        (x, y) => x.page - y.page || x.label.localeCompare(y.label, 'es'),
      ),
    [scoreId],
  );
  const [label, setLabel] = useState('');

  return (
    <Sheet title={b.title} closeLabel={t.close} onClose={onClose}>
      <form
        className="row-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!label.trim()) return;
          await addBookmark({ scoreId, page: currentPage, y: 0, label: label.trim() });
          setLabel('');
        }}
      >
        <input
          className="input"
          value={label}
          placeholder={b.placeholder}
          aria-label={b.name}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button className="btn primary" disabled={!label.trim()}>
          <Icon name="plus" size={18} />
          {b.addHere(currentPage + 1)}
        </button>
      </form>
      {bookmarks?.length === 0 && <span className="field-hint">{b.empty}</span>}
      <ul className="plain-list">
        {bookmarks?.map((bm) => (
          <li key={bm.id}>
            <button className="bookmark-go" onClick={() => onJump(bm.page)}>
              <Icon name="bookmark" size={18} />
              <strong>{bm.label}</strong>
              <span>{b.page(bm.page + 1)}</span>
            </button>
            <button
              className="icon-btn"
              aria-label={b.delete(bm.label)}
              onClick={() => void db.bookmarks.delete(bm.id)}
            >
              <Icon name="trash" size={18} />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
