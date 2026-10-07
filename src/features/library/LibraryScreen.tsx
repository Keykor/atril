import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { listScores, listTags, missingPdfIds } from '../../core/db/queries';
import { updateScore } from '../../core/db/repos';
import { filterScores } from '../../core/db/search';
import type { Score } from '../../core/db/types';
import { importFiles } from '../../core/pdf/import';
import { takeSharedFiles } from '../../core/pdf/shared';
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
  onExport?: (scoreId: string) => Promise<unknown>; // PDF con anotaciones, desde los datos
}

export function LibraryScreen({ tagId, onTag, onOpen, banner, onExport }: Props) {
  const scores = useLiveQuery(listScores, []);
  const tags = useLiveQuery(listTags, []);
  const missing = useLiveQuery(missingPdfIds, []);
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

  const importAll = async (files: { blob: Blob; name: string }[]) => {
    if (!files.length) return;
    const c = await importFiles(files, (done, total) =>
      setStatus(t.library.importing(done, total)),
    );
    setStatus(t.library.imported(c.added, c.duplicate, c.relinked, c.error));
    if (fileInput.current) fileInput.current.value = '';
  };
  const onFiles = (list: FileList | null) =>
    importAll(Array.from(list ?? []).map((f) => ({ blob: f, name: f.name })));

  // PDFs que llegaron por "Compartir" en Android (los dejó el service worker).
  useEffect(() => {
    void takeSharedFiles().then(importAll);
  }, []);

  // Destacadas primero, con cualquier orden o filtro.
  const pinned = shown.filter((s) => s.pinned);
  const others = shown.filter((s) => !s.pinned);
  const card = (s: Score) => (
    <li key={s.id} className="score-card">
      <button className="score-open" onClick={() => onOpen(s.id)}>
        <span className="score-thumb">
          <Thumb scoreId={s.id} />
        </span>
        <span className="score-info">
          <span className="score-title">{s.title}</span>
          <span className="score-composer">
            {missing?.has(s.pdfId) ? t.library.missingPdf : (s.composer ?? ' ')}
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
        className="icon-btn score-pin"
        aria-label={t.library.pin(s.title)}
        aria-pressed={!!s.pinned}
        onClick={() => void updateScore(s.id, { pinned: !s.pinned || undefined })}
      >
        <Icon name="star" size={18} />
      </button>
      <button
        className="icon-btn score-edit"
        aria-label={t.library.edit(s.title)}
        onClick={() => setEditing(s.id)}
      >
        <Icon name="more" />
      </button>
    </li>
  );

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
        <select
          className="btn"
          aria-label={t.library.sort}
          value={sort}
          onChange={(e) => setSort(e.target.value as 'recent' | 'az')}
        >
          <option value="recent">{t.library.sortRecent}</option>
          <option value="az">{t.library.sortAz}</option>
        </select>
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
      <TagNav tagId={tagId} onSelect={onTag} />

      {scores && shown.length === 0 ? (
        <p className="empty">{scores.length ? t.library.noResults : t.library.empty}</p>
      ) : (
        <>
          {pinned.length > 0 && (
            <>
              <h2 className="library-section">{t.library.pinned}</h2>
              <ul className="score-grid" aria-label={t.library.pinned}>
                {pinned.map(card)}
              </ul>
              {others.length > 0 && <h2 className="library-section">{t.library.others}</h2>}
            </>
          )}
          {others.length > 0 && (
            <ul className="score-grid" aria-label={t.library.scores}>
              {others.map(card)}
            </ul>
          )}
        </>
      )}

      {status && (
        <div className="toast" role="status">
          {status}
        </div>
      )}
      {editing && (
        <MetaSheet
          scoreId={editing}
          onClose={() => setEditing(undefined)}
          onExport={onExport && (() => onExport(editing))}
        />
      )}
    </>
  );
}
