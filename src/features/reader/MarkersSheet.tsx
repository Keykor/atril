import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../core/db/db';
import type { Bookmark, JumpLink } from '../../core/db/types';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { t } from '../../app/strings';
import { bookmarkAt } from './PageMarkers';

const b = t.bookmarks;

const useMarkers = (scoreId: string) =>
  useLiveQuery(
    async () => ({
      bookmarks: (await db.bookmarks.where('scoreId').equals(scoreId).toArray()).sort(
        (x, y) => x.page - y.page || x.y - y.y,
      ),
      links: await db.links.where('scoreId').equals(scoreId).toArray(),
    }),
    [scoreId],
  );

interface Props {
  scoreId: string;
  onGo: (bookmark: Bookmark) => void;
  onAdd: (kind: 'bookmark' | 'jump') => void;
  onClose: () => void;
}

/** Marcadores (lugares con nombre) y saltos (D.S., coda, repeticiones) de la partitura. */
export function MarkersSheet({ scoreId, onGo, onAdd, onClose }: Props) {
  const data = useMarkers(scoreId);
  return (
    <Sheet title={b.title} closeLabel={t.close} onClose={onClose}>
      <div className="field">
        <span className="field-label">{b.bookmarks}</span>
        {data?.bookmarks.length === 0 && <span className="field-hint">{b.empty}</span>}
        <ul className="plain-list">
          {data?.bookmarks.map((bm) => (
            <li key={bm.id}>
              <button className="bookmark-go" onClick={() => onGo(bm)}>
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
        <button className="btn" onClick={() => onAdd('bookmark')}>
          <Icon name="plus" size={18} />
          {b.add}
        </button>
      </div>

      <div className="field">
        <span className="field-label">{b.jumps}</span>
        <span className="field-hint">{b.jumpsHint}</span>
        <ul className="plain-list">
          {data?.links.map((l) => {
            const target = bookmarkAt(data.bookmarks, l.to)?.label ?? b.pageLong(l.to.page + 1);
            return (
              <li key={l.id}>
                <span>{b.jumpItem(l.from.page + 1, target)}</span>
                <button
                  className="icon-btn"
                  aria-label={b.deleteJump(l.from.page + 1, target)}
                  onClick={() => void db.links.delete(l.id)}
                >
                  <Icon name="trash" size={18} />
                </button>
              </li>
            );
          })}
        </ul>
        <button className="btn" onClick={() => onAdd('jump')}>
          <Icon name="plus" size={18} />
          {b.addJump}
        </button>
      </div>
    </Sheet>
  );
}

/** Segundo paso de un marcador nuevo: el nombre. */
export function BookmarkNameSheet({
  onSave,
  onClose,
}: {
  onSave: (label: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState('');
  return (
    <Sheet title={b.nameTitle} closeLabel={t.close} onClose={onClose}>
      <form
        className="row-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (label.trim()) onSave(label.trim());
        }}
      >
        <input
          className="input"
          autoFocus
          value={label}
          placeholder={b.placeholder}
          aria-label={b.name}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button className="btn primary" disabled={!label.trim()}>
          {t.save}
        </button>
      </form>
    </Sheet>
  );
}

/** Segundo paso de un salto nuevo: a dónde va (un marcador o una página). */
export function JumpTargetSheet({
  scoreId,
  pageCount,
  onPick,
  onClose,
}: {
  scoreId: string;
  pageCount: number;
  onPick: (to: JumpLink['to']) => void;
  onClose: () => void;
}) {
  const data = useMarkers(scoreId);
  const [value, setValue] = useState('1');
  const page = Number(value);
  const valid = Number.isInteger(page) && page >= 1 && page <= pageCount;
  const placed = data?.bookmarks.filter((bm) => bm.x !== undefined) ?? [];
  return (
    <Sheet title={b.jumpTarget} closeLabel={t.close} onClose={onClose}>
      {placed.length > 0 && (
        <div className="field">
          <span className="field-label">{b.toBookmark}</span>
          <ul className="plain-list">
            {placed.map((bm) => (
              <li key={bm.id}>
                <button
                  className="bookmark-go"
                  aria-label={b.jumpToBookmark(bm.label)}
                  onClick={() => onPick({ page: bm.page, y: bm.y })}
                >
                  <Icon name="bookmark" size={18} />
                  <strong>{bm.label}</strong>
                  <span>{b.page(bm.page + 1)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="field">
        <span className="field-label">{b.toPage(pageCount)}</span>
        <form
          className="row-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onPick({ page: page - 1, y: 0 });
          }}
        >
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            max={pageCount}
            aria-label={b.toPage(pageCount)}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button className="btn primary" disabled={!valid}>
            {t.save}
          </button>
        </form>
      </div>
    </Sheet>
  );
}
