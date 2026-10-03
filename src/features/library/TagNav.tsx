import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../core/db/db';
import { addTag, deleteTag } from '../../core/db/repos';
import { Icon } from '../../ui/Icon';
import { t } from '../../app/strings';
import './library.css';

const COLORS = ['#2950C7', '#C2410C', '#15803D', '#7E22CE', '#B45309', '#0E7490', '#BE185D'];

interface Props {
  tagId?: string;
  onSelect: (tagId?: string) => void;
  variant: 'sidebar' | 'chips';
}

/** Filtro por etiqueta: lista en la barra lateral (con alta y baja) o chips en celular. */
export function TagNav({ tagId, onSelect, variant }: Props) {
  const tags = useLiveQuery(() => db.tags.orderBy('name').toArray(), []) ?? [];
  const [adding, setAdding] = useState(false);
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
        <div key={tag.id} className="tag-row">
          <button
            className="tag-item"
            aria-pressed={tag.id === tagId}
            onClick={() => onSelect(tag.id)}
          >
            <span className="tag-dot" style={{ background: tag.color }} />
            {tag.name}
          </button>
          {variant === 'sidebar' && tag.id === tagId && (
            <button
              className="icon-btn tag-delete"
              aria-label={t.tags.delete(tag.name)}
              onClick={async () => {
                if (!confirm(t.tags.confirmDelete(tag.name))) return;
                await deleteTag(tag.id);
                onSelect(undefined);
              }}
            >
              <Icon name="trash" size={16} />
            </button>
          )}
        </div>
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
    </div>
  );
}
