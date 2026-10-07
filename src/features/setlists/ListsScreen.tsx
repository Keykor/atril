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
import { useMemo, useRef, useState } from 'react';
import { getSetting, listScores, listSetLists, listTags } from '../../core/db/queries';
import {
  addSetList,
  addTag,
  setSetting,
  deleteSetList,
  duplicateSetList,
  newId,
  updateSetList,
} from '../../core/db/repos';
import { filterScores, filterSetLists, type SetListFilter } from '../../core/db/search';
import type { Score, SetList, SetListItem, Tag } from '../../core/db/types';
import { language } from '../../core/language';
import { DateField } from '../../ui/controls';
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

const today = () => new Date().toLocaleDateString('sv'); // "YYYY-MM-DD" en hora local
const formatDate = (date: string) =>
  new Date(`${date}T12:00`).toLocaleDateString(language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export function ListsScreen({ listId, onSelect, onShow }: Props) {
  const lists = useLiveQuery(listSetLists, []);
  const tags = useLiveQuery(listTags, []) ?? [];
  const selected = lists?.find((l) => l.id === listId);
  const [naming, setNaming] = useState(false);
  const [filter, setFilter] = useState<SetListFilter>({});
  const s = t.lists;
  const now = today();
  const shown = filterSetLists(lists ?? [], filter, now);
  const set = (patch: SetListFilter) => setFilter((f) => ({ ...f, ...patch }));

  return (
    <div className={`lists${selected ? ' has-selection' : ''}`}>
      <section className="lists-index">
        <header className="screen-header">
          <h1>{s.title}</h1>
          <button className="btn primary" onClick={() => setNaming(true)}>
            <Icon name="plus" size={18} />
            {s.new}
          </button>
        </header>
        {lists?.length === 0 ? (
          <p className="empty">{s.empty}</p>
        ) : (
          <div className="lists-filters">
            <input
              className="input"
              type="search"
              aria-label={s.search}
              placeholder={s.search}
              value={filter.query ?? ''}
              onChange={(e) => set({ query: e.target.value })}
            />
            {tags.length > 0 && (
              <TagChips
                label={s.tags}
                tags={[{ id: '', name: s.allTags, color: '' }, ...tags]}
                pressed={(id) => (filter.tagId ?? '') === id}
                onToggle={(id) => set({ tagId: id || undefined })}
              />
            )}
            <div className="lists-dates">
              <label>
                <span>{s.from}</span>
                <input
                  className="input"
                  type="date"
                  value={filter.from ?? ''}
                  onChange={(e) => set({ from: e.target.value || undefined })}
                />
              </label>
              <label>
                <span>{s.to}</span>
                <input
                  className="input"
                  type="date"
                  value={filter.to ?? ''}
                  onChange={(e) => set({ to: e.target.value || undefined })}
                />
              </label>
              {(filter.from || filter.to) && (
                <button
                  className="icon-btn"
                  aria-label={s.clearDates}
                  onClick={() => set({ from: undefined, to: undefined })}
                >
                  <Icon name="close" size={18} />
                </button>
              )}
            </div>
          </div>
        )}
        {!!lists?.length && shown.length === 0 && <p className="empty">{s.noResults}</p>}
        {shown.length > 0 && (
          <div className="lists-table-head" aria-hidden="true">
            <span>{s.name}</span>
            <span>{s.date}</span>
            <span>{s.worksColumn}</span>
            <span>{s.tags}</span>
          </div>
        )}
        <ul aria-label={s.all} className="lists-table">
          {shown.map((l) => {
            const n = counts(l).scores;
            const listTags = tags.filter((tag) => l.tagIds?.includes(tag.id));
            return (
              <li key={l.id}>
                <button
                  className={`list-row${l.date && l.date < now ? ' past' : ''}`}
                  aria-current={l.id === listId || undefined}
                  onClick={() => onSelect(l.id)}
                >
                  <span className="list-row-name">
                    <strong>{l.name}</strong>
                    {l.notes && <small>{l.notes}</small>}
                  </span>
                  <span className="list-row-date">
                    {l.date ? (
                      <time dateTime={l.date}>{l.date === now ? s.today : formatDate(l.date)}</time>
                    ) : (
                      <span className="muted">{s.noDate}</span>
                    )}
                  </span>
                  <span className="list-row-count">{s.works(n)}</span>
                  <span className="list-row-tags">
                    {listTags.map((tag) => (
                      <span key={tag.id}>
                        <span className="tag-dot" style={{ background: tag.color }} />
                        {tag.name}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      {naming && (
        <NewList
          title={s.newTitle}
          submitLabel={s.create}
          onCancel={() => setNaming(false)}
          tags={tags}
          onCreate={async (name, date, tagIds) => {
            setNaming(false);
            onSelect((await addSetList(name, date, tagIds)).id);
          }}
        />
      )}
      {selected && (
        <Editor
          key={selected.id}
          list={selected}
          tags={tags}
          onBack={() => onSelect(undefined)}
          onSelect={onSelect}
          onShow={onShow}
        />
      )}
    </div>
  );
}

/** Etiquetas como chips que se prenden y apagan. */
function TagChips({
  label,
  tags,
  pressed,
  onToggle,
  onCreate,
}: {
  label: string;
  tags: Tag[];
  pressed: (id: string) => boolean;
  onToggle: (id: string) => void;
  onCreate?: (name: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  // Enter y el blur del campo llaman los dos: se crea una sola vez por apertura del campo.
  const created = useRef(false);
  const create = () => {
    if (created.current) return;
    created.current = true;
    const value = name.trim();
    setName('');
    setAdding(false);
    if (value) void onCreate?.(value);
  };
  return (
    <div className="list-tags" role="group" aria-label={label}>
      {tags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          aria-pressed={pressed(tag.id)}
          onClick={() => onToggle(tag.id)}
        >
          {tag.color && <span className="tag-dot" style={{ background: tag.color }} />}
          {tag.name}
        </button>
      ))}
      {onCreate &&
        (adding ? (
          // Sin <form> propio: estos chips también van dentro del formulario de lista nueva, y
          // un formulario anidado haría que Enter enviara el de afuera.
          <input
            className="input list-tag-input"
            autoFocus
            value={name}
            aria-label={t.lists.newTagName}
            placeholder={t.lists.newTag}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              create();
            }}
            onBlur={create}
          />
        ) : (
          <button
            type="button"
            className="list-tag-new"
            onClick={() => {
              created.current = false;
              setAdding(true);
            }}
          >
            <Icon name="plus" size={14} />
            {t.lists.newTag}
          </button>
        ))}
    </div>
  );
}

/**
 * Nombre, fecha y etiquetas de una lista nueva (o de la copia, al duplicar). La lista se crea
 * recién al confirmar: cancelar no deja una lista vacía.
 */
function NewList({
  title,
  submitLabel,
  tags,
  initialName = '',
  initialTagIds = [],
  onCancel,
  onCreate,
}: {
  title: string;
  submitLabel: string;
  tags: Tag[];
  initialName?: string;
  initialTagIds?: string[];
  onCancel: () => void;
  onCreate: (name: string, date: string | undefined, tagIds: string[]) => void;
}) {
  const s = t.lists;
  const [name, setName] = useState(initialName);
  const [date, setDate] = useState('');
  const [tagIds, setTagIds] = useState(initialTagIds);
  return (
    <Sheet
      title={title}
      closeLabel={t.close}
      onClose={onCancel}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onCancel}>
            {t.cancel}
          </button>
          <button type="submit" form="new-list" className="btn primary">
            {submitLabel}
          </button>
        </>
      }
    >
      <form
        id="new-list"
        className="new-list"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate(name.trim() || s.newName, date || undefined, tagIds);
        }}
      >
        <label className="field">
          <span className="field-label">{s.name}</span>
          <input
            className="input"
            autoFocus
            value={name}
            placeholder={s.newName}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <DateField label={s.date} value={date} onChange={setDate} clearLabel={s.noDate} />
        <div className="field">
          <span className="field-label">{s.tags}</span>
          <TagChips
            label={s.tags}
            tags={tags}
            pressed={(id) => tagIds.includes(id)}
            onToggle={(id) =>
              setTagIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
            }
            onCreate={async (tagName) => {
              const tag = await addTag(tagName);
              setTagIds((ids) => [...ids, tag.id]);
            }}
          />
        </div>
      </form>
    </Sheet>
  );
}

/**
 * Recordatorio al tocar Modo show: una web no puede silenciar el teléfono. Se puede apagar
 * ("No volver a recordarme"); vuelve con "Volver a mostrar todas las pistas".
 */
function DndReminder({
  onCancel,
  onStart,
}: {
  onCancel: () => void;
  onStart: (off: boolean) => void;
}) {
  const s = t.lists;
  const [off, setOff] = useState(false);
  return (
    <Sheet
      title={s.dndTitle}
      closeLabel={t.close}
      onClose={onCancel}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onCancel}>
            {t.cancel}
          </button>
          <button type="button" className="btn primary" onClick={() => onStart(off)}>
            <Icon name="play" size={18} />
            {s.dndStart}
          </button>
        </>
      }
    >
      <p className="dnd-text">{s.dnd}</p>
      <details className="dnd-reminder">
        <summary>{s.dndHow}</summary>
        <p>{s.dndAndroid}</p>
        <p>{s.dndIos}</p>
      </details>
      <label className="dnd-off">
        <input type="checkbox" checked={off} onChange={(e) => setOff(e.target.checked)} />
        {s.dndOff}
      </label>
    </Sheet>
  );
}

/** El campo de notas crece con el texto, sin manija para estirarlo. */
const grow = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

function Editor({
  list,
  tags,
  onBack,
  onSelect,
  onShow,
}: {
  list: SetList;
  tags: Tag[];
  onBack: () => void;
  onSelect: Props['onSelect'];
  onShow: Props['onShow'];
}) {
  const s = t.lists;
  const scores = useLiveQuery(listScores, []);
  const byId = useMemo(() => new Map((scores ?? []).map((sc) => [sc.id, sc])), [scores]);
  const [picking, setPicking] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [reminding, setReminding] = useState(false);
  const dndOff = useLiveQuery(() => getSetting('dndReminderOff', false), []) ?? false;
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
        <button className="btn" onClick={() => setDuplicating(true)}>
          <Icon name="copy" size={18} />
          {s.duplicate}
        </button>
        <button
          className="btn primary"
          disabled={first < 0}
          onClick={() => (dndOff ? onShow(list.id, first) : setReminding(true))}
        >
          <Icon name="play" size={18} />
          {s.show}
        </button>
      </header>

      <div className="list-meta">
        <DateField
          className="list-date"
          label={s.date}
          value={list.date ?? ''}
          onChange={(date) => updateSetList(list.id, { date: date || undefined })}
          clearLabel={s.noDate}
        />
        <div className="field">
          <span className="field-label">{s.tags}</span>
          <TagChips
            label={s.tags}
            tags={tags}
            pressed={(id) => !!list.tagIds?.includes(id)}
            onToggle={(id) =>
              updateSetList(list.id, {
                tagIds: list.tagIds?.includes(id)
                  ? list.tagIds.filter((x) => x !== id)
                  : [...(list.tagIds ?? []), id],
              })
            }
            onCreate={async (name) => {
              const tag = await addTag(name);
              await updateSetList(list.id, { tagIds: [...(list.tagIds ?? []), tag.id] });
            }}
          />
        </div>
      </div>

      <label className="field">
        <span className="field-label">{s.notes}</span>
        <textarea
          className="input list-notes"
          rows={1}
          ref={grow}
          onInput={(e) => grow(e.currentTarget)}
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
          await deleteSetList(list.id);
        }}
      >
        {s.delete}
      </button>

      {reminding && (
        <DndReminder
          onCancel={() => setReminding(false)}
          onStart={(off) => {
            if (off) void setSetting('dndReminderOff', true);
            setReminding(false);
            onShow(list.id, first);
          }}
        />
      )}
      {duplicating && (
        <NewList
          title={s.duplicateTitle}
          submitLabel={s.duplicate}
          initialName={`${list.name} ${s.copySuffix}`}
          tags={tags}
          initialTagIds={list.tagIds ?? []}
          onCancel={() => setDuplicating(false)}
          onCreate={async (name, date, tagIds) => {
            setDuplicating(false);
            onSelect((await duplicateSetList(list.id, name, date, tagIds))?.id);
          }}
        />
      )}
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
          <li key={sc.id} className={inList.has(sc.id) ? 'added' : undefined}>
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
