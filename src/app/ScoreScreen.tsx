import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../core/db/db';
import {
  addBookmark,
  addLink,
  getGlobalReading,
  getSetting,
  resolveReading,
  setSetting,
  touchScore,
  updateScore,
} from '../core/db/repos';
import type { JumpLink, ReadingPrefs, SetList } from '../core/db/types';
import { pageSizes } from '../core/pdf/render';
import { keepAwake } from '../core/wakeLock';
import { AnnotationLayer } from '../features/annotations/AnnotationLayer';
import { AnnotationToolbar } from '../features/annotations/AnnotationToolbar';
import { COLORS, type ToolState } from '../features/annotations/strokes';
import { useAnnotationHistory } from '../features/annotations/useHistory';
import { MetaSheet } from '../features/library/MetaSheet';
import { PracticePanel } from '../features/practice/PracticePanel';
import { BookmarkNameSheet, JumpTargetSheet, MarkersSheet } from '../features/reader/MarkersSheet';
import { bookmarkAt, PageMarkers, type PagePoint } from '../features/reader/PageMarkers';
import { PageSheet } from '../features/reader/PageSheet';
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

type SheetName = 'reading' | 'meta' | 'index' | 'page' | 'markers' | null;

interface Props {
  scoreId: string;
  show?: { list: SetList; index: number }; // modo show: la partitura es un ítem de una lista
}

/** Pantalla de lectura: compone el lector con las barras y las hojas de cada feature. */
export function ScoreScreen({ scoreId, show }: Props) {
  const score = useLiveQuery(() => db.scores.get(scoreId).then((s) => s ?? null), [scoreId]);
  const global = useLiveQuery(getGlobalReading, []);
  const penOnly = useLiveQuery(() => getSetting('penOnlyDrawing', false), []) ?? false;
  const bookmarks = useLiveQuery(
    () => db.bookmarks.where('scoreId').equals(scoreId).toArray(),
    [scoreId],
  );
  const [sizes, setSizes] = useState<{ w: number; h: number }[] | 'missing'>();
  const [view, setView] = useState<View>();
  const [bars, setBars] = useState(false);
  const [barsTick, setBarsTick] = useState(0);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [annotating, setAnnotating] = useState(false);
  // Modo show: la barra de abajo y el lápiz arrancan bloqueados; se habilitan con un toque.
  const [locked, setLocked] = useState(!!show);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const [tool, setTool] = useState<ToolState>({ tool: 'pen', color: COLORS[1], width: 1 });
  const [practice, setPractice] = useState(false);
  const [autoscrolling, setAutoscrolling] = useState(false);
  const [nextShown, setNextShown] = useState(false); // aviso de obra siguiente (modo show)
  // Marcador o salto nuevo: primero se toca el punto en la página, después se completa.
  const [placing, setPlacing] = useState<'bookmark' | 'jump'>();
  const [draft, setDraft] = useState<{ kind: 'bookmark' | 'jump'; point: PagePoint }>();
  // Después de saltar: a dónde se fue (para el scroll y el parpadeo) y desde dónde (para volver).
  const [target, setTarget] = useState<{ pos: number; y: number; nonce: number; id?: string }>();
  const [returnTo, setReturnTo] = useState<{ view: View; label: string }>();
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
  const half = view?.half;
  useEffect(() => {
    setNextShown(false); // si se movió de página, el aviso de "siguiente" ya no va
    if (pos === undefined) return;
    const id = setTimeout(() => void touchScore(scoreId, pos), 400);
    return () => clearTimeout(id);
  }, [scoreId, pos, half]);

  // Las barras se van solas a los 3 s, salvo que haya una hoja abierta o se las esté usando.
  useEffect(() => {
    if (!bars || sheet) return;
    const id = setTimeout(() => setBars(false), 3000);
    return () => clearTimeout(id);
  }, [bars, sheet, barsTick]);

  // El parpadeo de la banderita dura un par de segundos.
  useEffect(() => {
    if (!target?.id) return;
    const id = setTimeout(() => setTarget((x) => x && { ...x, id: undefined }), 2500);
    return () => clearTimeout(id);
  }, [target?.id, target?.nonce]);

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
  const vertical = prefs.mode === 'vertical';
  const currentPage = order[view.pos];
  const patch = (p: Parameters<typeof updateScore>[1]) => void updateScore(score.id, p);

  const changePrefs = (p: Partial<ReadingPrefs>, scope: 'score' | 'all') => {
    if (scope === 'score') return patch({ reading: { ...score.reading, ...p } });
    // Al cambiar el global se limpia el override de esta partitura, para que el cambio se vea.
    const reading = { ...score.reading };
    for (const key of Object.keys(p)) delete reading[key as keyof ReadingPrefs];
    void setSetting('reading', { ...global, ...p });
    patch({ reading });
  };

  const hideBars = () => {
    setSheet(null);
    setBars(false);
  };
  const startAnnotating = () => {
    setAnnotating(true);
    setAnnotationsVisible(true);
    hideBars();
  };
  const startPlacing = (kind: 'bookmark' | 'jump') => {
    hideBars();
    setPlacing(kind);
  };

  /** Va a un punto de una página real. Devuelve false si esa página no está en el orden virtual. */
  const goTo = (page: number, y: number, bookmarkId?: string) => {
    const targetPos = order.indexOf(page);
    if (targetPos < 0) return false;
    setView({ pos: targetPos, half: false });
    setTarget({ pos: targetPos, y, nonce: Date.now(), id: bookmarkId });
    return true;
  };
  const jump = (link: JumpLink) => {
    const from = view;
    const bookmark = bookmarkAt(bookmarks ?? [], link.to);
    if (goTo(link.to.page, link.to.y, bookmark?.id))
      setReturnTo({ view: from, label: bookmark?.label ?? t.bookmarks.pageLong(link.to.page + 1) });
  };

  // --- Modo show ---
  // replace: "atrás" vuelve a la lista, no a la obra anterior.
  const goShow = (index: number) => show && navigate(`/show/${show.list.id}/${index}`, true);
  const onEdge = (dir: 1 | -1) => {
    if (!show) return;
    if (dir === -1) {
      const prev = prevInShow(show.list, show.index);
      if (prev !== undefined) goShow(prev);
      return;
    }
    // Primer toque al final: aparece el aviso (así nunca tapa la música mientras se lee).
    // Segundo toque: abre la obra siguiente.
    if (!nextShown) return setNextShown(true);
    const next = nextInShow(show.list, show.index).next;
    if (next) goShow(next.index);
  };
  const atEnd = !nextView(view, {
    count: order.length,
    mode: prefs.mode,
    halfPage: prefs.halfPage && prefs.mode === 'paged',
    twoUpStep: prefs.twoUpStep,
  });
  const work = show && scoreNumber(show.list, show.index);
  const touchBars = () => setBarsTick((n) => n + 1);

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
        onCenterTap={() => !annotating && !placing && setBars((b) => !b)}
        onEdge={onEdge}
        scrollTarget={target}
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
            <PageMarkers
              scoreId={score.id}
              page={page}
              placing={!!placing}
              highlight={target?.id}
              jumpLabel={t.bookmarks.jumpTo}
              pageLabel={t.bookmarks.pageLong}
              placeLabel={t.bookmarks.placeLabel}
              onJump={jump}
              onPlace={(point) => {
                setDraft({ kind: placing!, point });
                setPlacing(undefined);
              }}
            />
          </>
        )}
      />

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

      {placing && (
        <div className="reader-float" onPointerDown={(e) => e.stopPropagation()}>
          {placing === 'bookmark' ? t.bookmarks.placeBookmark : t.bookmarks.placeJump}
          <button className="btn" onClick={() => setPlacing(undefined)}>
            {t.cancel}
          </button>
        </div>
      )}
      {returnTo && !annotating && !placing && (
        <div className="reader-float" onPointerDown={(e) => e.stopPropagation()}>
          {t.bookmarks.jumped(returnTo.label)}
          <button
            className="btn"
            onClick={() => {
              setView(returnTo.view);
              setReturnTo(undefined);
            }}
          >
            <Icon name="undo" size={18} />
            {t.bookmarks.jumpBack}
          </button>
        </div>
      )}
      {autoscrolling && vertical && (
        <div className="reader-float" style={{ pointerEvents: 'none', paddingRight: 16 }}>
          {t.page.autoscrollOn}
        </div>
      )}

      {show && <ShowProgress list={show.list} index={show.index} />}
      {practice && (
        <PracticePanel score={score} onChange={patch} onClose={() => setPractice(false)} />
      )}
      {show && atEnd && nextShown && !bars && !annotating && !practice && (
        <ShowNext list={show.list} index={show.index} onNext={goShow} />
      )}

      {bars && (
        <>
          <header className="reader-top" onPointerDown={touchBars}>
            <button className="back" onClick={back}>
              <Icon name="back" size={22} />
              <span>{show ? t.reader.backToList : t.reader.back}</span>
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
              aria-label={t.reader.page}
              onClick={() => {
                setSheet('page');
                setBars(false);
              }}
            >
              <Icon name="crop" size={22} />
            </button>
            <button
              className="icon-btn"
              aria-label={t.bookmarks.title}
              onClick={() => setSheet('markers')}
            >
              <Icon name="bookmark" size={22} />
            </button>
            <button className="icon-btn" aria-label={t.meta.title} onClick={() => setSheet('meta')}>
              <Icon name="more" size={22} />
            </button>
          </header>
          <footer className="reader-bottom" onPointerDown={touchBars}>
            {locked ? (
              // Modo show: la barra de abajo arranca bloqueada para no tocar nada sin querer
              // en escena. Un toque de confirmación la habilita (p. ej. ensayando la lista).
              <button className="reader-unlock" onClick={() => setLocked(false)}>
                <Icon name="lock" size={26} />
                {t.lists.unlock}
              </button>
            ) : (
              <>
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
                    <button
                      onClick={() => {
                        hideBars();
                        setAutoscrolling(true);
                      }}
                    >
                      <Icon name="play" size={26} />
                      {t.page.autoscroll}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setPractice(true);
                      setBars(false);
                    }}
                  >
                    <Icon name="metronome" size={26} />
                    {t.reader.practice}
                  </button>
                  <PlayStartNotes startNotes={score.startNotes} />
                  <button onClick={startAnnotating}>
                    <Icon name="pen" size={26} />
                    {t.reader.annotate}
                  </button>
                </div>
              </>
            )}
          </footer>
        </>
      )}

      {sheet === 'reading' && (
        <ReadingSheet
          prefs={prefs}
          penOnly={penOnly}
          onChange={changePrefs}
          onPenOnly={(v) => void setSetting('penOnlyDrawing', v)}
          autoscrollSpeed={score.autoscrollSpeed ?? 30}
          onAutoscrollSpeed={(autoscrollSpeed) => patch({ autoscrollSpeed })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'page' && (
        <PageSheet
          score={score}
          pageCount={sizes.length}
          order={order}
          currentPage={currentPage}
          annotationsVisible={annotationsVisible}
          onAnnotationsVisible={setAnnotationsVisible}
          onPatch={patch}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'markers' && (
        <MarkersSheet
          scoreId={score.id}
          onAdd={startPlacing}
          onClose={() => setSheet(null)}
          onGo={(b) => {
            hideBars();
            goTo(b.page, b.y, b.id);
          }}
        />
      )}
      {draft?.kind === 'bookmark' && (
        <BookmarkNameSheet
          onClose={() => setDraft(undefined)}
          onSave={(label) => {
            void addBookmark({ scoreId: score.id, label, ...draft.point });
            setDraft(undefined);
          }}
        />
      )}
      {draft?.kind === 'jump' && (
        <JumpTargetSheet
          scoreId={score.id}
          pageCount={sizes.length}
          onClose={() => setDraft(undefined)}
          onPick={(to) => {
            void addLink({ scoreId: score.id, from: draft.point, to });
            setDraft(undefined);
          }}
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
      {sheet === 'meta' && (
        <MetaSheet scoreId={score.id} onClose={() => setSheet(null)} onDeleted={back} />
      )}
    </div>
  );
}
