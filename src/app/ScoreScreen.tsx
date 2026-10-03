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
import { addLink } from '../core/db/repos';
import type { JumpLink, ReadingPrefs, SetList } from '../core/db/types';
import { pageSizes } from '../core/pdf/render';
import { keepAwake } from '../core/wakeLock';
import { AnnotationLayer } from '../features/annotations/AnnotationLayer';
import { AnnotationToolbar } from '../features/annotations/AnnotationToolbar';
import { COLORS, type ToolState } from '../features/annotations/strokes';
import { useAnnotationHistory } from '../features/annotations/useHistory';
import { MetaSheet } from '../features/library/MetaSheet';
import { PracticePanel } from '../features/practice/PracticePanel';
import { BookmarksSheet } from '../features/reader/BookmarksSheet';
import { JumpMarkers } from '../features/reader/JumpMarkers';
import { JumpTargetSheet, MoreSheet } from '../features/reader/MoreSheet';
import { PageStrip } from '../features/reader/PageStrip';
import { Reader } from '../features/reader/Reader';
import { ReadingSheet } from '../features/reader/ReadingSheet';
import { nextView, resolveOrder, type View } from '../features/reader/sequence';
import { nextInShow, prevInShow, scoreNumber } from '../features/setlists/show';
import { ShowIndex, ShowNext, ShowProgress } from '../features/setlists/ShowParts';
import { Icon } from '../ui/Icon';
import { PlayStartNotes } from './reader-tools';
import { back, navigate } from './router';
import { t } from './strings';

type SheetName = 'reading' | 'meta' | 'index' | 'more' | 'bookmarks' | null;

interface Props {
  scoreId: string;
  show?: { list: SetList; index: number }; // modo show: la partitura es un ítem de una lista
}

/** Pantalla de lectura: compone el lector con las barras y las hojas de cada feature. */
export function ScoreScreen({ scoreId, show }: Props) {
  const score = useLiveQuery(() => db.scores.get(scoreId).then((s) => s ?? null), [scoreId]);
  const global = useLiveQuery(getGlobalReading, []);
  const penOnly = useLiveQuery(() => getSetting('penOnlyDrawing', false), []) ?? false;
  const [sizes, setSizes] = useState<{ w: number; h: number }[] | 'missing'>();
  const [view, setView] = useState<View>();
  const [bars, setBars] = useState(false);
  const [barsTick, setBarsTick] = useState(0);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [annotating, setAnnotating] = useState(false);
  const [locked, setLocked] = useState(!!show); // en modo show no se raya en escena
  const [practice, setPractice] = useState(false);
  const [autoscrolling, setAutoscrolling] = useState(false);
  const [returnTo, setReturnTo] = useState<View>(); // desde dónde se saltó, para volver
  // Salto nuevo: primero se toca el origen en la página, después se elige el destino.
  const [jumpDraft, setJumpDraft] = useState<'placing' | JumpLink['from']>();
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const [tool, setTool] = useState<ToolState>({ tool: 'pen', color: COLORS[1], width: 1 });
  const history = useAnnotationHistory();

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
      const pos = Math.min(v?.pos ?? (show ? 0 : score.lastPage), order.length - 1);
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

  const startAnnotating = () => {
    setAnnotating(true);
    setAnnotationsVisible(true);
    setBars(false);
  };

  // replace: "atrás" vuelve a la lista, no a la obra anterior.
  const goShow = (index: number) => show && navigate(`/show/${show.list.id}/${index}`, true);
  const onEdge = (dir: 1 | -1) => {
    if (!show) return;
    const target =
      dir === 1 ? nextInShow(show.list, show.index).next?.index : prevInShow(show.list, show.index);
    if (target !== undefined) goShow(target);
  };
  const atEnd = !nextView(view, {
    count: order.length,
    mode: prefs.mode,
    halfPage: prefs.halfPage && prefs.mode === 'paged',
    twoUpStep: prefs.twoUpStep,
  });
  const work = show && scoreNumber(show.list, show.index);
  const currentPage = order[view.pos];
  const vertical = prefs.mode === 'vertical';

  const goToPage = (page: number) => {
    const target = order.indexOf(page);
    if (target >= 0) setView({ pos: target, half: false });
    return target >= 0;
  };
  const jump = (link: JumpLink) => {
    const from = view;
    if (goToPage(link.to.page)) setReturnTo(from);
  };
  const startAutoscroll = () => {
    setSheet(null);
    setBars(false);
    setAutoscrolling(true);
  };

  return (
    <div className={`score-screen${annotationsVisible ? '' : ' annotations-hidden'}`}>
      <Reader
        pdfId={score.pdfId}
        sizes={sizes}
        order={order}
        crop={score.crop}
        prefs={prefs}
        view={view}
        onView={setView}
        onCenterTap={() => !annotating && setBars((b) => !b)}
        onEdge={onEdge}
        autoscroll={autoscrolling && vertical ? (score.autoscrollSpeed ?? 30) : undefined}
        interceptTap={() => {
          if (!autoscrolling) return false;
          setAutoscrolling(false); // un toque pausa el autoscroll
          return true;
        }}
        overlay={(page) => (
          <>
            <AnnotationLayer
              scoreId={score.id}
              page={page}
              aspect={sizes[page].h / sizes[page].w}
              active={annotating}
              locked={locked}
              penOnly={penOnly}
              tool={tool}
              label={t.annotate.layer}
              textPlaceholder={t.annotate.textPlaceholder}
              onPenStart={startAnnotating}
              onCommit={history.commit}
              onUndo={history.undo}
            />
            <JumpMarkers
              scoreId={score.id}
              page={page}
              placing={jumpDraft === 'placing'}
              jumpLabel={t.more.jumpTo}
              placeLabel={t.more.placeJumpLabel}
              onJump={jump}
              onPlace={setJumpDraft}
            />
          </>
        )}
      />

      {jumpDraft === 'placing' && (
        <div className="reader-float" onPointerDown={(e) => e.stopPropagation()}>
          {t.more.placeJump}
          <button className="btn" onClick={() => setJumpDraft(undefined)}>
            {t.cancel}
          </button>
        </div>
      )}
      {returnTo && !annotating && (
        <div className="reader-float" onPointerDown={(e) => e.stopPropagation()}>
          {t.more.jumped(currentPage + 1)}
          <button
            className="btn"
            onClick={() => {
              setView(returnTo);
              setReturnTo(undefined);
            }}
          >
            <Icon name="undo" size={18} />
            {t.more.jumpBack}
          </button>
        </div>
      )}
      {autoscrolling && vertical && (
        <div className="reader-float" style={{ pointerEvents: 'none', paddingRight: 16 }}>
          {t.more.autoscrollOn}
        </div>
      )}

      {annotating && (
        <AnnotationToolbar
          tool={tool}
          onTool={setTool}
          penOnly={penOnly}
          onPenOnly={(v) => void setSetting('penOnlyDrawing', v)}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onUndo={history.undo}
          onRedo={history.redo}
          onDone={() => setAnnotating(false)}
        />
      )}

      {show && <ShowProgress list={show.list} index={show.index} />}
      {practice && (
        <PracticePanel
          score={score}
          onChange={(patch) => void updateScore(score.id, patch)}
          onClose={() => setPractice(false)}
        />
      )}

      {show && atEnd && !bars && !annotating && !practice && (
        <ShowNext list={show.list} index={show.index} onNext={goShow} />
      )}

      {bars && (
        <>
          <header className="reader-top" onPointerDown={() => setBarsTick((n) => n + 1)}>
            <button className="back" onClick={back}>
              <Icon name="back" size={22} />
              <span>{t.reader.back}</span>
            </button>
            <div className="reader-title">
              {show && work ? (
                <button aria-label={t.lists.index} onClick={() => setSheet('index')}>
                  <strong>{score.title}</strong>
                  <span>
                    {show.list.name} · {t.lists.workOf(work.n, work.total)}
                  </span>
                </button>
              ) : (
                <>
                  <strong>{score.title}</strong>
                  <span>{score.composer ?? t.reader.pageOf(view.pos + 1, order.length)}</span>
                </>
              )}
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
              aria-label={annotationsVisible ? t.annotate.hide : t.annotate.show}
              aria-pressed={!annotationsVisible}
              onClick={() => setAnnotationsVisible((v) => !v)}
            >
              <Icon name="eye" size={22} />
            </button>
            <button
              className="icon-btn"
              aria-label={t.reader.bookmarks}
              onClick={() => setSheet('bookmarks')}
            >
              <Icon name="bookmark" size={22} />
            </button>
            <button
              className="icon-btn"
              aria-label={t.reader.more}
              onClick={() => setSheet('more')}
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
            <div className="reader-divider" />
            <div className="reader-tools">
              {vertical && (
                <button onClick={startAutoscroll}>
                  <Icon name="play" size={26} />
                  {t.more.autoscroll}
                </button>
              )}
              <button
                onClick={() => {
                  setPractice(true);
                  setBars(false);
                }}
              >
                <Icon name="metronome" size={26} />
                {t.reader.metronome}
              </button>
              <button
                onClick={() => {
                  setPractice(true);
                  setBars(false);
                }}
              >
                <Icon name="keyboard" size={26} />
                {t.reader.keyboard}
              </button>
              <PlayStartNotes startNotes={score.startNotes} />
              {locked ? (
                <button onClick={() => setLocked(false)}>
                  <Icon name="lock" size={26} />
                  {t.lists.locked}
                </button>
              ) : (
                <button onClick={startAnnotating}>
                  <Icon name="pen" size={26} />
                  {t.reader.annotate}
                </button>
              )}
            </div>
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
      {sheet === 'index' && show && (
        <ShowIndex
          list={show.list}
          index={show.index}
          onClose={() => setSheet(null)}
          onPick={(i) => {
            setSheet(null);
            goShow(i);
          }}
        />
      )}
      {sheet === 'more' && (
        <MoreSheet
          score={score}
          pageCount={sizes.length}
          order={order}
          currentPage={currentPage}
          vertical={vertical}
          onPatch={(patch) => void updateScore(score.id, patch)}
          onEditMeta={() => setSheet('meta')}
          onAutoscroll={startAutoscroll}
          onAddJump={() => {
            setSheet(null);
            setBars(false);
            setJumpDraft('placing');
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'bookmarks' && (
        <BookmarksSheet
          scoreId={score.id}
          currentPage={currentPage}
          onClose={() => setSheet(null)}
          onJump={(page) => {
            setSheet(null);
            goToPage(page);
          }}
        />
      )}
      {jumpDraft && jumpDraft !== 'placing' && (
        <JumpTargetSheet
          pageCount={sizes.length}
          onClose={() => setJumpDraft(undefined)}
          onPick={(page) => {
            void addLink({ scoreId: score.id, from: jumpDraft, to: { page, y: 0 } });
            setJumpDraft(undefined);
          }}
        />
      )}
      {sheet === 'meta' && (
        <MetaSheet scoreId={score.id} onClose={() => setSheet(null)} onDeleted={back} />
      )}
    </div>
  );
}
