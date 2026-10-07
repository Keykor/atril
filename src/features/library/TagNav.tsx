import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { listTags } from '../../core/db/queries';
import { addTag, deleteTag, renameTag } from '../../core/db/repos';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { t } from '../../app/strings';
import './library.css';

interface Props {
  tagId?: string;
  onSelect: (tagId?: string) => void;
}

/** Filtro por etiqueta: chips arriba de las partituras. */
export function TagNav({ tagId, onSelect }: Props) {
  const tags = useLiveQuery(listTags, []) ?? [];
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  // Enter y el blur del campo llaman los dos: se crea una sola vez por apertura del campo.
  const created = useRef(false);
  const create = () => {
    if (created.current) return;
    created.current = true;
    const value = name.trim();
    setName('');
    setAdding(false);
    if (value) void addTag(value);
  };

  return (
    <div className="tagnav chips">
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
            create();
          }}
        >
          <input
            className="input"
            autoFocus
            value={name}
            placeholder={t.tags.namePlaceholder}
            aria-label={t.tags.namePlaceholder}
            onChange={(e) => setName(e.target.value)}
            onBlur={create}
          />
        </form>
      ) : (
        <button
          className="tag-item tag-new"
          onClick={() => {
            created.current = false;
            setAdding(true);
          }}
        >
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
                    if (next && next !== tag.name) void renameTag(tag.id, next);
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
