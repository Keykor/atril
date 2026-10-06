import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { formatStartNotes, parseStartNotes } from '../../core/audio/notes';
import { getScore, listTags } from '../../core/db/queries';
import { deleteScore, updateScore } from '../../core/db/repos';
import type { Score } from '../../core/db/types';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { t } from '../../app/strings';
import './library.css';

interface Props {
  scoreId: string;
  onClose: () => void;
  onDeleted?: () => void;
  // Exportar el PDF con anotaciones. Viene de afuera (src/app compone): las anotaciones son
  // otra feature.
  onExport?: () => Promise<unknown>;
}

const FORM_ID = 'meta-form';

/**
 * Editor de metadatos. Se usa desde la biblioteca y desde el lector. Solo "Guardar" escribe:
 * cerrar o cancelar descarta los cambios.
 */
export function MetaSheet({ scoreId, onClose, onDeleted, onExport }: Props) {
  const score = useLiveQuery(() => getScore(scoreId), [scoreId]);
  const tags = useLiveQuery(listTags, []) ?? [];
  if (!score) return null;
  const remove = async () => {
    if (!confirm(t.meta.confirmDelete(score.title))) return;
    onClose();
    onDeleted?.();
    await deleteScore(score.id);
  };
  return (
    <Sheet
      title={t.meta.title}
      closeLabel={t.close}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn danger" onClick={remove}>
            {t.meta.delete}
          </button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" form={FORM_ID} className="btn primary">
            {t.save}
          </button>
        </>
      }
    >
      <Form key={score.id} score={score} tags={tags} onSaved={onClose} />
      {onExport && <ExportSection onExport={onExport} />}
    </Sheet>
  );
}

type TextField = 'title' | 'composer' | 'key' | 'timeSignature';

function Form({
  score,
  tags,
  onSaved,
}: {
  score: Score;
  tags: { id: string; name: string; color: string }[];
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    title: score.title,
    composer: score.composer ?? '',
    key: score.key ?? '',
    timeSignature: score.timeSignature ?? '',
    bpm: score.bpm ? String(score.bpm) : '',
    startNotes: formatStartNotes(score.startNotes),
    tagIds: score.tagIds,
  });
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const bpm = Number(draft.bpm);
    const startNotes = parseStartNotes(draft.startNotes);
    await updateScore(score.id, {
      title: draft.title.trim() || score.title,
      composer: draft.composer.trim() || undefined,
      key: draft.key.trim() || undefined,
      timeSignature: draft.timeSignature.trim() || undefined,
      bpm: bpm ? Math.min(250, Math.max(30, Math.round(bpm))) : undefined,
      startNotes: startNotes.length ? startNotes : undefined,
      tagIds: draft.tagIds,
    });
    onSaved();
  };

  const text = (field: TextField, label: string, ph = '') => (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="input"
        value={draft[field]}
        placeholder={ph}
        onChange={(e) => set({ [field]: e.target.value })}
      />
    </label>
  );

  return (
    <form id={FORM_ID} className="meta-form" onSubmit={save}>
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
            value={draft.bpm}
            onChange={(e) => set({ bpm: e.target.value })}
          />
        </label>
        {text('timeSignature', t.meta.timeSignature, '4/4')}
      </div>
      <label className="field">
        <span className="field-label">{t.meta.startNotes}</span>
        <input
          className="input"
          value={draft.startNotes}
          onChange={(e) => set({ startNotes: e.target.value })}
          onBlur={() => set({ startNotes: formatStartNotes(parseStartNotes(draft.startNotes)) })}
        />
        <span className="field-hint">{t.meta.startNotesHint}</span>
      </label>
      {tags.length > 0 && (
        <div className="field">
          <span className="field-label">{t.meta.tags}</span>
          <div className="tagnav chips wrap">
            {tags.map((tag) => {
              const on = draft.tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className="tag-item"
                  aria-pressed={on}
                  onClick={() =>
                    set({
                      tagIds: on
                        ? draft.tagIds.filter((id) => id !== tag.id)
                        : [...draft.tagIds, tag.id],
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
    </form>
  );
}

/** Imprimir o compartir: arma el PDF con las anotaciones. Aparte del formulario: no guarda nada. */
function ExportSection({ onExport }: { onExport: () => Promise<unknown> }) {
  const [state, setState] = useState<'idle' | 'working' | 'error' | 'missing'>('idle');
  const run = async () => {
    setState('working');
    try {
      await onExport();
      setState('idle');
    } catch (e) {
      console.error(e);
      setState((e as Error).message === 'missing-pdf' ? 'missing' : 'error');
    }
  };
  return (
    <section className="meta-export">
      <h3>{t.meta.exportTitle}</h3>
      <p className="field-hint">{t.meta.exportHint}</p>
      <button type="button" className="btn" disabled={state === 'working'} onClick={run}>
        <Icon name="download" size={18} />
        {state === 'working' ? t.meta.exporting : t.meta.export}
      </button>
      {(state === 'error' || state === 'missing') && (
        <p role="status" className="meta-export-error">
          {state === 'missing' ? t.meta.exportMissing : t.meta.exportError}
        </p>
      )}
    </section>
  );
}
