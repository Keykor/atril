import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../core/db/db';
import type { Crop, Score } from '../../core/db/types';
import { detectCrop } from '../../core/pdf/render';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { t } from '../../app/strings';
import { formatPageOrder, parsePageOrder } from './sequence';

const m = t.more;
const NO_CROP: Crop = { top: 0, right: 0, bottom: 0, left: 0 };

interface Props {
  score: Score;
  pageCount: number;
  order: number[];
  currentPage: number; // página real a la vista
  vertical: boolean;
  onPatch: (patch: Partial<Score>) => void;
  onEditMeta: () => void;
  onAutoscroll: () => void;
  onAddJump: () => void;
  onClose: () => void;
}

/** "Más opciones" del lector: datos, orden virtual, recorte, autoscroll y saltos. */
export function MoreSheet(p: Props) {
  const links = useLiveQuery(
    () => db.links.where('scoreId').equals(p.score.id).toArray(),
    [p.score.id],
  );
  const [orderText, setOrderText] = useState(formatPageOrder(p.order));
  const [detecting, setDetecting] = useState(false);
  const crop = p.score.crop ?? NO_CROP;
  const setCrop = (patch: Partial<Crop>) => p.onPatch({ crop: { ...crop, ...patch } });

  return (
    <Sheet title={m.title} closeLabel={t.close} onClose={p.onClose}>
      <button className="btn" onClick={p.onEditMeta}>
        <Icon name="edit" size={18} />
        {t.meta.title}
      </button>

      <label className="field">
        <span className="field-label">{m.pageOrder}</span>
        <input
          className="input"
          inputMode="numeric"
          value={orderText}
          onChange={(e) => setOrderText(e.target.value)}
          onBlur={() => {
            const pageOrder = parsePageOrder(orderText, p.pageCount);
            p.onPatch({ pageOrder });
            if (!pageOrder)
              setOrderText(formatPageOrder(Array.from({ length: p.pageCount }, (_, i) => i)));
          }}
        />
        <span className="field-hint">{m.pageOrderHint(p.pageCount)}</span>
      </label>

      <div className="field">
        <span className="field-label">{m.crop}</span>
        <div className="row">
          <button
            className="btn"
            disabled={detecting}
            onClick={async () => {
              setDetecting(true);
              const found = await detectCrop(p.score.pdfId, p.currentPage).catch(() => undefined);
              if (found) p.onPatch({ crop: found });
              setDetecting(false);
            }}
          >
            {m.cropAuto}
          </button>
          <button className="btn ghost" onClick={() => p.onPatch({ crop: undefined })}>
            {m.cropReset}
          </button>
        </div>
        <div className="crop-sliders">
          {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
            <label key={side}>
              <span>{m.cropSides[side]}</span>
              <input
                type="range"
                min={0}
                max={30}
                value={Math.round(crop[side] * 100)}
                onChange={(e) => setCrop({ [side]: Number(e.target.value) / 100 })}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">{m.autoscroll}</span>
        {p.vertical ? (
          <div className="crop-sliders">
            <label>
              <span>{m.speed}</span>
              <input
                type="range"
                min={5}
                max={200}
                step={5}
                value={p.score.autoscrollSpeed ?? 30}
                aria-label={m.speed}
                onChange={(e) => p.onPatch({ autoscrollSpeed: Number(e.target.value) })}
              />
            </label>
            <button className="btn primary" onClick={p.onAutoscroll}>
              <Icon name="play" size={18} />
              {m.autoscrollStart}
            </button>
          </div>
        ) : (
          <span className="field-hint">{m.autoscrollOnlyVertical}</span>
        )}
      </div>

      <div className="field">
        <span className="field-label">{m.jumps}</span>
        <span className="field-hint">{m.jumpsHint}</span>
        <ul className="plain-list">
          {links?.map((l) => (
            <li key={l.id}>
              <span>{m.jumpItem(l.from.page + 1, l.to.page + 1)}</span>
              <button
                className="icon-btn"
                aria-label={m.deleteJump(l.from.page + 1, l.to.page + 1)}
                onClick={() => void db.links.delete(l.id)}
              >
                <Icon name="trash" size={18} />
              </button>
            </li>
          ))}
        </ul>
        <button className="btn" onClick={p.onAddJump}>
          <Icon name="plus" size={18} />
          {m.addJump}
        </button>
      </div>
    </Sheet>
  );
}

/** Segundo paso de un salto nuevo: a qué página va. */
export function JumpTargetSheet({
  pageCount,
  onPick,
  onClose,
}: {
  pageCount: number;
  onPick: (page: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('1');
  const page = Number(value);
  const valid = Number.isInteger(page) && page >= 1 && page <= pageCount;
  return (
    <Sheet title={m.jumpTarget} closeLabel={t.close} onClose={onClose}>
      <form
        className="row-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onPick(page - 1);
        }}
      >
        <input
          className="input"
          type="number"
          inputMode="numeric"
          min={1}
          max={pageCount}
          autoFocus
          aria-label={m.jumpTargetLabel(pageCount)}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="btn primary" disabled={!valid}>
          {t.save}
        </button>
      </form>
      <span className="field-hint">{m.jumpTargetLabel(pageCount)}</span>
    </Sheet>
  );
}
