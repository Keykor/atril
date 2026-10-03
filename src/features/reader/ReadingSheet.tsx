import { useState } from 'react';
import type { ReadingPrefs } from '../../core/db/types';
import { Segmented, Switch } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';
import { t } from '../../app/strings';

interface Props {
  prefs: ReadingPrefs; // lo que se ve ahora (global + override de la partitura)
  onChange: (patch: Partial<ReadingPrefs>, scope: 'score' | 'all') => void;
  autoscrollSpeed: number; // px por segundo, de esta partitura
  onAutoscrollSpeed: (speed: number) => void;
  onClose: () => void;
}

export function ReadingSheet({
  prefs,
  onChange,
  autoscrollSpeed,
  onAutoscrollSpeed,
  onClose,
}: Props) {
  const [scope, setScope] = useState<'score' | 'all'>('score');
  const r = t.reading;
  const set = (patch: Partial<ReadingPrefs>) => onChange(patch, scope);

  return (
    <Sheet title={r.title} closeLabel={t.close} onClose={onClose}>
      <Segmented
        label={r.applyTo}
        value={scope}
        onChange={setScope}
        options={[
          { value: 'score', label: r.thisScore },
          { value: 'all', label: r.allScores },
        ]}
      />
      <Segmented
        label={r.mode}
        value={prefs.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'paged', label: r.paged },
          { value: 'vertical', label: r.vertical },
          { value: 'two-up', label: r.twoUp },
        ]}
      />
      {prefs.mode === 'two-up' ? (
        <Segmented
          label={r.twoUpStep}
          value={prefs.twoUpStep}
          onChange={(twoUpStep) => set({ twoUpStep })}
          options={[
            { value: 1, label: r.stepOne },
            { value: 2, label: r.stepTwo },
          ]}
        />
      ) : (
        prefs.mode === 'paged' && (
          <Segmented
            label={r.pageTurn}
            value={prefs.pageTurn}
            onChange={(pageTurn) => set({ pageTurn })}
            options={[
              { value: 'slide', label: r.slide },
              { value: 'instant', label: r.instant },
            ]}
          />
        )
      )}
      {prefs.mode === 'vertical' && (
        <label className="field">
          <span className="field-label">{r.autoscrollSpeed}</span>
          <span className="range-row">
            <input
              type="range"
              className="range"
              min={5}
              max={200}
              step={5}
              value={autoscrollSpeed}
              onChange={(e) => onAutoscrollSpeed(Number(e.target.value))}
            />
            <output className="range-value">{autoscrollSpeed}</output>
          </span>
          <span className="field-hint">{r.autoscrollHint}</span>
        </label>
      )}
      <div className="sheet-cols">
        <Segmented
          label={r.fit}
          value={prefs.fit}
          onChange={(fit) => set({ fit })}
          options={[
            { value: 'width', label: r.fitWidth },
            { value: 'page', label: r.fitPage },
          ]}
        />
        <Segmented
          label={r.theme}
          value={prefs.theme}
          onChange={(theme) => set({ theme })}
          options={[
            { value: 'light', label: r.light },
            { value: 'sepia', label: r.sepia },
            { value: 'dark', label: r.dark },
          ]}
        />
      </div>
      <div>
        <Switch
          label={r.halfPage}
          hint={r.halfPageHint}
          checked={prefs.halfPage}
          onChange={(halfPage) => set({ halfPage })}
        />
      </div>
      <div className="field">
        <span className="field-label">{r.tapZones}</span>
        <div className="option-cards" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {(['thirds', 'halves'] as const).map((z) => (
            <button
              key={z}
              type="button"
              aria-pressed={prefs.tapZones === z}
              onClick={() => set({ tapZones: z })}
            >
              {r[z]}
              <small>{r[`${z}Hint`]}</small>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
