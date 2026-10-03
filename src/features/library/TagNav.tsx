import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../core/db/db';
import { addTag, deleteTag } from '../../core/db/repos';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { t } from '../../app/strings';
import './library.css';

const COLORS = ['#2950C7', '#C2410C', '#15803D', '#7E22CE', '#B45309', '#0E7490', '#BE185D'];

interface Props {
  tagId?: string;
  onSelect: (tagId?: string) => void;
  variant: 'sidebar' | 'chips';
}

/** Filtro por etiqueta: lista en la barra lateral o chips en celular. */
export function TagNav({ tagId, onSelect, variant }: Props) {
  const tags = useLiveQuery(() => db.tags.orderBy('name').toArray(), []) ?? [];
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const create = async () => {
    if (name.trim()) await addTag(name.trim(), COLORS[tags.length % COLORS.length]);
    setName('');
    setAdding(false);
  };

  return (
    <div className={`tagnav ${variant}`}>
      {variant === 'sidebar' && <div className="tagnav-title">{t.tags.title}</div>}
      <button className="tag-item" aria-pressed={!tagId} onClick={() => onSelect(undefined)}>
        <span className="tag-dot hollow" />
        {t.tags.all}
      </button>
      {tags.map((tag) => (
        <button
          key={tag.id}
          className="tag-item"
          aria-pressed={tag.id === tagId}
          onClick={() => onSelect(tag.id)}
        >
          <span className="tag-dot" style={{ background: tag.color }} />
          {tag.name}
        </button>
      ))}
      {adding ? (
        <form
          className="tag-form"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <input
            className="input"
            autoFocus
            value={name}
            placeholder={t.tags.namePlaceholder}
            aria-label={t.tags.namePlaceholder}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void create()}
          />
        </form>
      ) : (
        <button className="tag-item tag-new" onClick={() => setAdding(true)}>
          <Icon name="plus" size={14} />
          {t.tags.new}
        </button>
      )}
      {tags.length > 0 && (
        <button className="tag-item tag-new" onClick={() => setEditing(true)}>
          <Icon name="edit" size={14} />
          {t.tags.edit}
        </button>
      )}

      {editing && (
        <Sheet title={t.tags.edit} closeLabel={t.close} onClose={() => setEditing(false)}>
          <ul className="plain-list">
            {tags.map((tag) => (
              <li key={tag.id}>
                <span className="tag-dot" style={{ background: tag.color }} />
                <input
                  className="input"
                  aria-label={t.tags.rename(tag.name)}
                  defaultValue={tag.name}
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next && next !== tag.name) void db.tags.update(tag.id, { name: next });
                  }}
                />
                <button
                  className="icon-btn"
                  aria-label={t.tags.delete(tag.name)}
                  onClick={async () => {
                    if (!confirm(t.tags.confirmDelete(tag.name))) return;
                    await deleteTag(tag.id);
                    if (tag.id === tagId) onSelect(undefined);
                  }}
                >
                  <Icon name="trash" size={18} />
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </div>
  );
}
