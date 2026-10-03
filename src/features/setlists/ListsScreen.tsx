import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db, newId } from '../../core/db/db';
import { addSetList, duplicateSetList, updateSetList } from '../../core/db/repos';
import { filterScores } from '../../core/db/search';
import type { Score, SetList, SetListItem } from '../../core/db/types';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { t } from '../../app/strings';
import { counts } from './show';
import './setlists.css';

interface Props {
  listId?: string;
  onSelect: (listId?: string) => void;
  onShow: (listId: string, index: number) => void;
}

export function ListsScreen({ listId, onSelect, onShow }: Props) {
  const lists = useLiveQuery(() => db.setlists.orderBy('name').toArray(), []);
  const selected = lists?.find((l) => l.id === listId);
  const s = t.lists;

  return (
    <div className={`lists${selected ? ' has-selection' : ''}`}>
      <section className="lists-index">
        <header className="screen-header">
          <h1>{s.title}</h1>
          <button
            className="btn primary"
            onClick={async () => onSelect((await addSetList(s.newName)).id)}
          >
            <Icon name="plus" size={18} />
            {s.new}
          </button>
        </header>
        {lists?.length === 0 && <p className="empty">{s.empty}</p>}
        <ul aria-label={s.all}>
          {lists?.map((l) => (
            <li key={l.id}>
              <button aria-current={l.id === listId || undefined} onClick={() => onSelect(l.id)}>
                <strong>{l.name}</strong>
                <span>{s.count(counts(l).scores, counts(l).breaks)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {selected && (
        <Editor
          key={selected.id}
          list={selected}
          onBack={() => onSelect(undefined)}
          onSelect={onSelect}
          onShow={onShow}
        />
      )}
    </div>
  );
}

function Editor({
  list,
  onBack,
  onSelect,
  onShow,
}: {
  list: SetList;
  onBack: () => void;
  onSelect: Props['onSelect'];
  onShow: Props['onShow'];
}) {
  const s = t.lists;
  const scores = useLiveQuery(() => db.scores.toArray(), []);
  const byId = useMemo(() => new Map((scores ?? []).map((sc) => [sc.id, sc])), [scores]);
  const [picking, setPicking] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const setItems = (items: SetListItem[]) => void updateSetList(list.id, { items });
  const patchItem = (id: string, patch: Partial<SetListItem>) =>
    setItems(list.items.map((i) => (i.id === id ? ({ ...i, ...patch } as SetListItem) : i)));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = list.items.findIndex((i) => i.id === active.id);
    const to = list.items.findIndex((i) => i.id === over.id);
    setItems(arrayMove(list.items, from, to));
  };

  const first = list.items.findIndex((i) => i.type === 'score');
  let n = 0;

  return (
    <section className="list-editor">
      <header className="screen-header">
        <button className="icon-btn only-narrow-inline" aria-label={s.all} onClick={onBack}>
          <Icon name="back" />
        </button>
        <input
          className="list-name"
          aria-label={s.name}
          defaultValue={list.name}
          onBlur={(e) =>
            e.target.value.trim() && updateSetList(list.id, { name: e.target.value.trim() })
          }
        />
        <button
          className="btn"
          onClick={async () => onSelect((await duplicateSetList(list.id, s.copySuffix))?.id)}
        >
          <Icon name="copy" size={18} />
          {s.duplicate}
        </button>
        <button className="btn primary" disabled={first < 0} onClick={() => onShow(list.id, first)}>
          <Icon name="play" size={18} />
          {s.show}
        </button>
      </header>

      <label className="field">
        <span className="field-label">{s.notes}</span>
        <textarea
          className="input"
          rows={2}
          defaultValue={list.notes ?? ''}
          onBlur={(e) => updateSetList(list.id, { notes: e.target.value.trim() || undefined })}
        />
      </label>

      <div className="list-order-head">
        <h2>{s.order}</h2>
        <button className="btn ghost" onClick={() => setPicking(true)}>
          <Icon name="plus" size={16} />
          {s.addScores}
        </button>
        <button
          className="btn ghost"
          onClick={() =>
            setItems([...list.items, { id: newId(), type: 'break', label: s.breakLabel }])
          }
        >
          <Icon name="plus" size={16} />
          {s.addBreak}
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={list.items} strategy={verticalListSortingStrategy}>
          <ol className="list-items" aria-label={s.orderLabel}>
            {list.items.map((item, index) => (
              <Row
                key={item.id}
                item={item}
                number={item.type === 'score' ? ++n : 0}
                score={item.type === 'score' ? byId.get(item.scoreId) : undefined}
                onPatch={(patch) => patchItem(item.id, patch)}
                onRemove={() => setItems(list.items.filter((i) => i.id !== item.id))}
                onOpen={() => onShow(list.id, index)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {list.items.length === 0 && <p className="empty">{s.emptyList}</p>}

      <button
        className="btn danger list-delete"
        onClick={async () => {
          if (!confirm(s.confirmDelete(list.name))) return;
          onSelect(undefined);
          await db.setlists.delete(list.id);
        }}
      >
        {s.delete}
      </button>

      {picking && (
        <Picker
          scores={scores ?? []}
          inList={new Set(list.items.flatMap((i) => (i.type === 'score' ? [i.scoreId] : [])))}
          onAdd={(scoreId) => setItems([...list.items, { id: newId(), type: 'score', scoreId }])}
          onClose={() => setPicking(false)}
        />
      )}
    </section>
  );
}

function Row({
  item,
  number,
  score,
  onPatch,
  onRemove,
  onOpen,
}: {
  item: SetListItem;
  number: number;
  score?: Score;
  onPatch: (patch: Partial<SetListItem>) => void;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const s = t.lists;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const name = item.type === 'score' ? (score?.title ?? s.missingScore) : item.label;
  return (
    <li
      ref={setNodeRef}
      className={`list-item ${item.type}${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button className="icon-btn grip" aria-label={s.move(name)} {...attributes} {...listeners}>
        <Icon name="grip" />
      </button>
      {item.type === 'score' ? (
        <>
          <span className="list-num">{number}</span>
          <button className="list-item-main" onClick={onOpen}>
            <strong>{name}</strong>
            <span>{score?.composer}</span>
          </button>
          {score?.key && <span className="chip outline">{score.key}</span>}
          <input
            className="list-note"
            aria-label={s.itemNote(name)}
            placeholder={s.itemNotePlaceholder}
            defaultValue={item.note ?? ''}
            onBlur={(e) => onPatch({ note: e.target.value.trim() || undefined })}
          />
        </>
      ) : (
        <input
          className="list-break"
          aria-label={s.breakName}
          defaultValue={item.label}
          onBlur={(e) => onPatch({ label: e.target.value.trim() || s.breakLabel })}
        />
      )}
      <button className="icon-btn" aria-label={s.remove(name)} onClick={onRemove}>
        <Icon name="close" size={18} />
      </button>
    </li>
  );
}

function Picker({
  scores,
  inList,
  onAdd,
  onClose,
}: {
  scores: Score[];
  inList: Set<string>;
  onAdd: (scoreId: string) => void;
  onClose: () => void;
}) {
  const s = t.lists;
  const [query, setQuery] = useState('');
  const shown = filterScores(scores, { query, sort: 'az' });
  return (
    <Sheet title={s.addScores} closeLabel={t.close} onClose={onClose}>
      <input
        className="input"
        type="search"
        value={query}
        placeholder={t.library.searchPlaceholder}
        aria-label={t.library.search}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="picker">
        {shown.map((sc) => (
          <li key={sc.id}>
            <span>
              <strong>{sc.title}</strong>
              <small>{sc.composer}</small>
            </span>
            <button className="btn" aria-label={s.addOne(sc.title)} onClick={() => onAdd(sc.id)}>
              <Icon name={inList.has(sc.id) ? 'check' : 'plus'} size={16} />
              {inList.has(sc.id) ? s.addAgain : t.add}
            </button>
          </li>
        ))}
        {shown.length === 0 && <p className="empty">{t.library.noResults}</p>}
      </ul>
    </Sheet>
  );
}
