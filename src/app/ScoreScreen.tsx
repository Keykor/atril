import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../core/db/db';
import {
  getGlobalReading,
  getSetting,
  resolveReading,
  setSetting,
  touchScore,
  updateScore,
} from '../core/db/repos';
import type { ReadingPrefs } from '../core/db/types';
import { pageSizes } from '../core/pdf/render';
import { keepAwake } from '../core/wakeLock';
import { MetaSheet } from '../features/library/MetaSheet';
import { PageStrip } from '../features/reader/PageStrip';
import { Reader } from '../features/reader/Reader';
import { ReadingSheet } from '../features/reader/ReadingSheet';
import { resolveOrder, type View } from '../features/reader/sequence';
import { Icon } from '../ui/Icon';
import { back } from './router';
import { t } from './strings';

type SheetName = 'reading' | 'meta' | null;

/** Pantalla de lectura: compone el lector con las barras y las hojas de cada feature. */
export function ScoreScreen({ scoreId }: { scoreId: string }) {
  const score = useLiveQuery(() => db.scores.get(scoreId).then((s) => s ?? null), [scoreId]);
  const global = useLiveQuery(getGlobalReading, []);
  const penOnly = useLiveQuery(() => getSetting('penOnlyDrawing', false), []) ?? false;
  const [sizes, setSizes] = useState<{ w: number; h: number }[] | 'missing'>();
  const [view, setView] = useState<View>();
  const [bars, setBars] = useState(false);
  const [barsTick, setBarsTick] = useState(0);
  const [sheet, setSheet] = useState<SheetName>(null);

  const pdfId = score?.pdfId;
  useEffect(() => {
    if (!pdfId) return;
    let alive = true;
    pageSizes(pdfId)
      .then((s) => alive && setSizes(s))
      .catch(() => alive && setSizes('missing'));
    return () => {
      alive = false;
    };
  }, [pdfId]);

  useEffect(() => keepAwake(), []);

  const pageCount = Array.isArray(sizes) ? sizes.length : 0;
  const order = useMemo(
    () => resolveOrder(score?.pageOrder, pageCount),
    [score?.pageOrder, pageCount],
  );

  // Vista inicial: la última página leída. Si el orden virtual se achica, se acota.
  useEffect(() => {
    if (!score || !order.length) return;
    setView((v) => {
      const pos = Math.min(v?.pos ?? score.lastPage, order.length - 1);
      return v && v.pos === pos ? v : { pos, half: false };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score?.id, order.length]);

  const pos = view?.pos;
  useEffect(() => {
    if (pos === undefined) return;
    const id = setTimeout(() => void touchScore(scoreId, pos), 400);
    return () => clearTimeout(id);
  }, [scoreId, pos]);

  // Las barras se van solas a los 3 s, salvo que haya una hoja abierta o se las esté usando.
  useEffect(() => {
    if (!bars || sheet) return;
    const id = setTimeout(() => setBars(false), 3000);
    return () => clearTimeout(id);
  }, [bars, sheet, barsTick]);

  if (score === null || sizes === 'missing')
    return (
      <div className="score-screen reader-message">
        <p>{score === null ? t.reader.notFound : t.reader.missingPdf}</p>
        <button className="btn" onClick={back}>
          <Icon name="back" />
          {t.reader.back}
        </button>
      </div>
    );
  if (!score || !global || !Array.isArray(sizes) || !view)
    return <div className="score-screen reader-message">{t.reader.loading}</div>;

  const prefs = resolveReading(global, score);

  const changePrefs = (patch: Partial<ReadingPrefs>, scope: 'score' | 'all') => {
    if (scope === 'score')
      return void updateScore(score.id, { reading: { ...score.reading, ...patch } });
    // Al cambiar el global se limpia el override de esta partitura, para que el cambio se vea.
    const reading = { ...score.reading };
    for (const key of Object.keys(patch)) delete reading[key as keyof ReadingPrefs];
    void setSetting('reading', { ...global, ...patch });
    void updateScore(score.id, { reading });
  };

  return (
    <div className="score-screen">
      <Reader
        pdfId={score.pdfId}
        sizes={sizes}
        order={order}
        crop={score.crop}
        prefs={prefs}
        view={view}
        onView={setView}
        onCenterTap={() => setBars((b) => !b)}
      />

      {bars && (
        <>
          <header className="reader-top" onPointerDown={() => setBarsTick((n) => n + 1)}>
            <button className="back" onClick={back}>
              <Icon name="back" size={22} />
              <span>{t.reader.back}</span>
            </button>
            <div className="reader-title">
              <strong>{score.title}</strong>
              <span>{score.composer ?? t.reader.pageOf(view.pos + 1, order.length)}</span>
            </div>
            <button
              className="icon-btn"
              aria-label={t.reader.settings}
              onClick={() => setSheet('reading')}
            >
              <Icon name="sliders" size={22} />
            </button>
            <button
              className="icon-btn"
              aria-label={t.reader.more}
              onClick={() => setSheet('meta')}
            >
              <Icon name="more" size={22} />
            </button>
          </header>
          <footer className="reader-bottom" onPointerDown={() => setBarsTick((n) => n + 1)}>
            <PageStrip
              pdfId={score.pdfId}
              order={order}
              pos={view.pos}
              label={t.reader.pages}
              onPick={(p) => setView({ pos: p, half: false })}
            />
          </footer>
        </>
      )}

      {sheet === 'reading' && (
        <ReadingSheet
          prefs={prefs}
          penOnly={penOnly}
          onChange={changePrefs}
          onPenOnly={(v) => void setSetting('penOnlyDrawing', v)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'meta' && (
        <MetaSheet scoreId={score.id} onClose={() => setSheet(null)} onDeleted={back} />
      )}
    </div>
  );
}
