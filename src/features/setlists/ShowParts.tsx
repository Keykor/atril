import { useLiveQuery } from 'dexie-react-hooks';
import { getScore, listScores } from '../../core/db/queries';
import type { SetList } from '../../core/db/types';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { t } from '../../app/strings';
import { nextInShow, scoreNumber } from './show';
import './setlists.css';

const describe = (s?: { title: string; composer?: string; key?: string } | null) =>
  s ? [s.title, s.composer, s.key].filter(Boolean).join(' · ') : t.lists.missingScore;

/** Progreso de la lista: una barrita por obra. */
export function ShowProgress({ list, index }: { list: SetList; index: number }) {
  const { n, total } = scoreNumber(list, index);
  return (
    <div className="show-progress" aria-label={t.lists.workOf(n, total)}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} data-done={i < n || undefined} />
      ))}
    </div>
  );
}

/** Aviso en la última página: qué viene y un botón grande para seguir. */
export function ShowNext({
  list,
  index,
  onNext,
}: {
  list: SetList;
  index: number;
  onNext: (index: number) => void;
}) {
  const { breaks, next } = nextInShow(list, index);
  const score = useLiveQuery(() => (next ? getScore(next.scoreId) : undefined), [next?.scoreId]);
  const s = t.lists;
  if (!next)
    return (
      <div className="show-next" onPointerDown={(e) => e.stopPropagation()}>
        <div>
          <small>{s.endOfList}</small>
          <strong>{list.name}</strong>
        </div>
      </div>
    );
  return (
    <div className="show-next" onPointerDown={(e) => e.stopPropagation()}>
      <div>
        <small>{breaks.length ? breaks.join(' · ') : s.next}</small>
        <strong>{breaks.length ? s.after(describe(score)) : describe(score)}</strong>
      </div>
      <button className="btn primary" aria-label={s.nextWork} onClick={() => onNext(next.index)}>
        {breaks.length ? s.continue : s.next}
        <Icon name="right" size={22} />
      </button>
    </div>
  );
}

/** Índice de la lista para saltar a cualquier obra. */
export function ShowIndex({
  list,
  index,
  onPick,
  onClose,
}: {
  list: SetList;
  index: number;
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  const scores = useLiveQuery(listScores, []);
  const byId = new Map((scores ?? []).map((sc) => [sc.id, sc]));
  let n = 0;
  return (
    <Sheet title={list.name} closeLabel={t.close} onClose={onClose}>
      <ol className="show-index">
        {list.items.map((item, i) =>
          item.type === 'break' ? (
            <li key={item.id} className="break">
              {item.label}
            </li>
          ) : (
            <li key={item.id}>
              <button aria-current={i === index || undefined} onClick={() => onPick(i)}>
                <span className="list-num">{++n}</span>
                <span>
                  <strong>{byId.get(item.scoreId)?.title ?? t.lists.missingScore}</strong>
                  {item.note && <small>{item.note}</small>}
                </span>
              </button>
            </li>
          ),
        )}
      </ol>
    </Sheet>
  );
}
