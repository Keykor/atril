import { useState } from 'react';
import type { Crop, Score } from '../../core/db/types';
import { detectCrop } from '../../core/pdf/render';
import { Switch } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';
import { t } from '../../app/strings';
import { formatPageOrder, parsePageOrder } from './sequence';

const m = t.page;
const NO_CROP: Crop = { top: 0, right: 0, bottom: 0, left: 0 };

interface Props {
  score: Score;
  pageCount: number;
  order: number[];
  currentPage: number; // página real a la vista
  annotationsVisible: boolean;
  onAnnotationsVisible: (visible: boolean) => void;
  onPatch: (patch: Partial<Score>) => void;
  onClose: () => void;
}

/**
 * Cómo se ve la página de esta partitura: recorte, orden virtual y capa de anotaciones.
 * No es modal: la partitura queda a la vista para ver el recorte mientras se mueve.
 */
export function PageSheet(p: Props) {
  const [orderText, setOrderText] = useState(formatPageOrder(p.order));
  const [detecting, setDetecting] = useState(false);
  const crop = p.score.crop ?? NO_CROP;

  return (
    <Sheet title={m.title} closeLabel={t.close} onClose={p.onClose} modal={false}>
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
                onChange={(e) =>
                  p.onPatch({ crop: { ...crop, [side]: Number(e.target.value) / 100 } })
                }
              />
            </label>
          ))}
        </div>
      </div>

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

      <Switch
        label={m.showAnnotations}
        checked={p.annotationsVisible}
        onChange={p.onAnnotationsVisible}
      />
    </Sheet>
  );
}
