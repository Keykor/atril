import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../../core/db/db';
import { filterScores } from '../../core/db/search';
import { importFiles } from '../../core/pdf/import';
import { Icon } from '../../ui/Icon';
import { t } from '../../app/strings';
import { MetaSheet } from './MetaSheet';
import { TagNav } from './TagNav';
import { Thumb } from './Thumb';
import './library.css';

interface Props {
  tagId?: string;
  onTag: (tagId?: string) => void;
  onOpen: (scoreId: string) => void;
  banner?: React.ReactNode;
}

export function LibraryScreen({ tagId, onTag, onOpen, banner }: Props) {
  const scores = useLiveQuery(() => db.scores.toArray(), []);
  const tags = useLiveQuery(() => db.tags.toArray(), []);
  const missing = useLiveQuery(
    async () => new Set(await db.pdfs.filter((p) => !!p.missing).primaryKeys()),
    [],
  );
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'az'>('recent');
  const [editing, setEditing] = useState<string>();
  const [status, setStatus] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  const shown = useMemo(
    () => filterScores(scores ?? [], { query, tagId, sort }),
    [scores, query, tagId, sort],
  );
  const tagById = useMemo(() => new Map((tags ?? []).map((tag) => [tag.id, tag])), [tags]);

  useEffect(() => {
    if (!status || status.endsWith('…')) return;
    const id = setTimeout(() => setStatus(undefined), 4000);
    return () => clearTimeout(id);
  }, [status]);

  const onFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []).map((f) => ({ blob: f, name: f.name }));
    if (!files.length) return;
    const c = await importFiles(files, (done, total) =>
      setStatus(t.library.importing(done, total)),
    );
    setStatus(t.library.imported(c.added, c.duplicate, c.relinked, c.error));
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <>
      <header className="screen-header">
        <h1>{t.library.title}</h1>
        <label className="search">
          <Icon name="search" size={18} />
          <span className="sr-only">{t.library.search}</span>
          <input
            type="search"
            value={query}
            placeholder={t.library.searchPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          className="btn"
          aria-label={t.library.sort}
          onClick={() => setSort(sort === 'recent' ? 'az' : 'recent')}
        >
          {sort === 'recent' ? t.library.sortRecent : t.library.sortAz}
          <Icon name="down" size={16} />
        </button>
        <button className="btn primary" onClick={() => fileInput.current?.click()}>
          <Icon name="upload" size={18} />
          {t.library.import}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          data-testid="import-input"
          onChange={(e) => void onFiles(e.target.files)}
        />
      </header>

      {banner}
      <div className="only-narrow">
        <TagNav tagId={tagId} onSelect={onTag} variant="chips" />
      </div>

      {scores && shown.length === 0 ? (
        <p className="empty">{scores.length ? t.library.noResults : t.library.empty}</p>
      ) : (
        <ul className="score-grid" aria-label={t.library.scores}>
          {shown.map((s) => (
            <li key={s.id} className="score-card">
              <button className="score-open" onClick={() => onOpen(s.id)}>
                <span className="score-thumb">
                  <Thumb scoreId={s.id} />
                </span>
                <span className="score-info">
                  <span className="score-title">{s.title}</span>
                  <span className="score-composer">
                    {missing?.has(s.pdfId) ? t.library.missingPdf : (s.composer ?? ' ')}
                  </span>
                  <span className="score-chips">
                    {s.tagIds.slice(0, 1).map((id) => (
                      <span key={id} className="chip">
                        {tagById.get(id)?.name}
                      </span>
                    ))}
                    {s.key && <span className="chip outline">{s.key}</span>}
                  </span>
                </span>
              </button>
              <button
                className="icon-btn score-edit"
                aria-label={t.library.edit(s.title)}
                onClick={() => setEditing(s.id)}
              >
                <Icon name="more" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {status && (
        <div className="toast" role="status">
          {status}
        </div>
      )}
      {editing && <MetaSheet scoreId={editing} onClose={() => setEditing(undefined)} />}
    </>
  );
}
