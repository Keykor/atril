import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { formatStartNotes, parseStartNotes } from '../../core/audio/notes';
import { db } from '../../core/db/db';
import { deleteScore, updateScore } from '../../core/db/repos';
import type { Score } from '../../core/db/types';
import { Sheet } from '../../ui/Sheet';
import { t } from '../../app/strings';
import './library.css';

interface Props {
  scoreId: string;
  onClose: () => void;
  onDeleted?: () => void;
}

/** Editor de metadatos. Se usa desde la biblioteca y desde el lector. */
export function MetaSheet({ scoreId, onClose, onDeleted }: Props) {
  const score = useLiveQuery(() => db.scores.get(scoreId), [scoreId]);
  const tags = useLiveQuery(() => db.tags.orderBy('name').toArray(), []) ?? [];
  if (!score) return null;
  return (
    <Sheet title={t.meta.title} closeLabel={t.close} onClose={onClose}>
      <Form key={score.id} score={score} tags={tags} onClose={onClose} onDeleted={onDeleted} />
    </Sheet>
  );
}

function Form({
  score,
  tags,
  onClose,
  onDeleted,
}: Omit<Props, 'scoreId'> & { score: Score; tags: { id: string; name: string; color: string }[] }) {
  const [startNotes, setStartNotes] = useState(formatStartNotes(score.startNotes));
  const set = (patch: Partial<Score>) => void updateScore(score.id, patch);
  const text = (field: 'title' | 'composer' | 'key' | 'timeSignature', label: string, ph = '') => (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="input"
        defaultValue={score[field] ?? ''}
        placeholder={ph}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (field === 'title' ? v : true) set({ [field]: v || undefined });
        }}
      />
    </label>
  );

  return (
    <>
      {text('title', t.meta.name)}
      {text('composer', t.meta.composer)}
      <div className="meta-grid">
        {text('key', t.meta.key, t.meta.keyPlaceholder)}
        <label className="field">
          <span className="field-label">{t.meta.bpm}</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={30}
            max={250}
            defaultValue={score.bpm ?? ''}
            onBlur={(e) => {
              const n = Number(e.target.value);
              set({ bpm: n ? Math.min(250, Math.max(30, Math.round(n))) : undefined });
            }}
          />
        </label>
        {text('timeSignature', t.meta.timeSignature, '4/4')}
      </div>
      <label className="field">
        <span className="field-label">{t.meta.startNotes}</span>
        <input
          className="input"
          value={startNotes}
          onChange={(e) => setStartNotes(e.target.value)}
          onBlur={() => {
            const parsed = parseStartNotes(startNotes);
            set({ startNotes: parsed.length ? parsed : undefined });
            setStartNotes(formatStartNotes(parsed));
          }}
        />
        <span className="field-hint">{t.meta.startNotesHint}</span>
      </label>
      {tags.length > 0 && (
        <div className="field">
          <span className="field-label">{t.meta.tags}</span>
          <div className="tagnav chips wrap">
            {tags.map((tag) => {
              const on = score.tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  className="tag-item"
                  aria-pressed={on}
                  onClick={() =>
                    set({
                      tagIds: on
                        ? score.tagIds.filter((id) => id !== tag.id)
                        : [...score.tagIds, tag.id],
                    })
                  }
                >
                  <span className="tag-dot" style={{ background: tag.color }} />
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <button
        className="btn danger"
        onClick={async () => {
          if (!confirm(t.meta.confirmDelete(score.title))) return;
          onClose();
          onDeleted?.();
          await deleteScore(score.id);
        }}
      >
        {t.meta.delete}
      </button>
    </>
  );
}
