import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import type { Crop, ReadingPrefs } from '../../core/db/types';
import { renderPage } from '../../core/pdf/render';
import { PageView } from './PageView';
import { croppedAspect, nextView, pageGeometry, prevView, type Seq, type View } from './sequence';
import './reader.css';

interface Props {
  pdfId: string;
  sizes: { w: number; h: number }[]; // tamaño de cada página real
  order: number[]; // orden virtual -> página real
  crop?: Crop;
  prefs: ReadingPrefs;
  view: View;
  onView: (view: View) => void;
  onCenterTap: () => void; // mostrar u ocultar las barras
  onEdge?: (dir: 1 | -1) => void; // se quiso pasar más allá del final o del principio
  interceptTap?: () => boolean; // true = el toque ya se usó (p. ej. pausar el autoscroll)
  overlay?: (page: number) => ReactNode; // capas por página real (anotaciones, saltos)
  autoscroll?: number; // px por segundo; solo en modo vertical
  // Ir a un punto de una página (marcador). `y` es 0..1 de la página real. En paginado la
  // página ya se ve entera, así que solo se usa en modo vertical.
  scrollTarget?: { pos: number; y: number; nonce: number };
  // Anotando: el navegador no desplaza la página con el dedo (así el dedo dibuja). Dos dedos
  // la mueven y hacen zoom.
  manualPan?: boolean;
  fitToggle?: number; // cambia: alterna entre al ancho y página entera, y saca el zoom
}

const TURN_MS = 180;
const GAP = 8; // separación entre páginas en modo vertical
const FORWARD = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'];
const BACK = ['ArrowLeft', 'ArrowUp', 'PageUp'];

export function Reader(p: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [fitOverride, setFitOverride] = useState<ReadingPrefs['fit']>();

  const { mode } = p.prefs;
  const fit = fitOverride ?? p.prefs.fit;
  const count = p.order.length;
  const seq: Seq = {
    count,
    mode,
    halfPage: p.prefs.halfPage && mode === 'paged',
    twoUpStep: p.prefs.twoUpStep,
  };
  // ponytail: la hoja solo sigue al dedo en paginado de una página; con media página o dos
  // páginas el cambio es instantáneo (montar vecinos ahí pasaría de los 5 bitmaps de la cache).
  const sliding = mode === 'paged' && p.prefs.pageTurn === 'slide' && !seq.halfPage && zoom === 1;
  // Con zoom, un dedo mueve la página a mano: así se sabe cuándo llegó al borde y hay que pasar.
  const manualPan = !!p.manualPan || zoom > 1;

  const toggleFit = () => {
    setFitOverride(fit === 'page' ? 'width' : 'page');
    setZoom(1);
  };
  const fitToggle = useRef(p.fitToggle);
  useEffect(() => {
    if (p.fitToggle === fitToggle.current) return;
    fitToggle.current = p.fitToggle;
    toggleFit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.fitToggle]);

  useEffect(() => {
    const el = stage.current!;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageBox = (pos: number, cols = 1) => {
    const size = p.sizes[p.order[pos]];
    const aspect = croppedAspect(size, p.crop);
    const maxW = box.w / cols;
    const w = fit === 'page' ? Math.min(maxW, box.h / aspect) : maxW;
    return { pos, w, h: w * aspect };
  };

  const renderPageAt = ({ pos, w }: { pos: number; w: number }) => {
    const page = p.order[pos];
    return (
      <PageView
        key={pos}
        pdfId={p.pdfId}
        page={page}
        size={p.sizes[page]}
        crop={p.crop}
        width={w}
        quality={zoom}
      >
        {p.overlay?.(page)}
      </PageView>
    );
  };

  // --- Cambio de página ---

  const latest = useRef({ view: p.view, onView: p.onView });
  latest.current = { view: p.view, onView: p.onView };
  const anim = useRef<{ timer: number; commit: () => void } | null>(null);

  const setTrack = (x: number, animated: boolean) => {
    const el = track.current;
    if (!el) return;
    el.style.transition = animated ? `transform ${TURN_MS}ms ease-out` : 'none';
    el.style.transform = x ? `translateX(${x}px)` : '';
  };

  const finishAnim = () => {
    if (!anim.current) return;
    clearTimeout(anim.current.timer);
    anim.current.commit();
    anim.current = null;
  };

  const turn = (dir: 1 | -1, target: View) => {
    if (!sliding) return p.onView(target);
    const commit = () => {
      // flushSync: los slots se reacomodan y la pista vuelve a 0 en el mismo frame.
      flushSync(() => latest.current.onView(target));
      setTrack(0, false);
    };
    setTrack(-dir * box.w, true);
    anim.current = { commit, timer: window.setTimeout(finishAnim, TURN_MS) };
  };

  const go = (dir: 1 | -1) => {
    finishAnim();
    if (mode === 'vertical') {
      const el = scroller.current!;
      const atEnd = el.scrollTop >= el.scrollHeight - el.clientHeight - 2;
      if (dir === 1 ? atEnd : el.scrollTop <= 0) return p.onEdge?.(dir);
      return el.scrollBy({ top: dir * box.h * 0.85, behavior: 'smooth' });
    }
    // Ajuste al ancho: la página es más alta que la pantalla, primero se recorre. Con zoom no:
    // el toque al costado pasa de hoja y la nueva arranca arriba a la izquierda.
    const slot = track.current?.querySelector<HTMLElement>('[data-where="0"]');
    if (zoom === 1 && slot && slot.scrollHeight > slot.clientHeight + 4) {
      const more =
        dir === 1 ? slot.scrollTop + slot.clientHeight < slot.scrollHeight - 4 : slot.scrollTop > 4;
      if (more) return slot.scrollBy({ top: dir * box.h * 0.85, behavior: 'smooth' });
    }
    const view = latest.current.view;
    const target = dir === 1 ? nextView(view, seq) : prevView(view, seq);
    if (!target) return p.onEdge?.(dir);
    turn(dir, target);
  };
  const goRef = useRef(go);
  goRef.current = go;

  // Teclado: flechas, PageUp/PageDown y espacio. Los pedales Bluetooth mandan estas teclas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea, [role="dialog"]')) return;
      const dir = FORWARD.includes(e.key) ? 1 : BACK.includes(e.key) ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      goRef.current(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Sin slots vecinos montados, la página siguiente se pre-renderiza igual.
  const next = mode === 'vertical' ? null : nextView(p.view, seq);
  useEffect(() => {
    if (!next || !box.w || sliding) return;
    const cols = mode === 'two-up' ? 2 : 1;
    const { w } = pageBox(next.pos, cols);
    const page = p.order[next.pos];
    void renderPage(p.pdfId, page, Math.round(pageGeometry(p.sizes[page], p.crop, w).fullW * zoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next?.pos, box.w, box.h, sliding, mode, fit, zoom, p.pdfId]);

  // --- Gestos ---

  const g = useRef({
    pointers: new Map<number, { x: number; y: number }>(),
    start: null as { id: number; x: number; y: number; t: number } | null,
    last: { x: 0, y: 0 },
    moved: false,
    swiping: false,
    panning: false,
    dx: 0,
    over: 0, // con zoom: lo que el dedo siguió de largo contra el borde horizontal
    pinch: null as { dist: number; zoom: number; mid: { x: number; y: number } } | null,
    z: 1,
    longTimer: 0,
    tapTimer: 0,
    lastCenterTap: -Infinity,
  }).current;

  const pinchDist = () => {
    const [a, b] = [...g.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const pinchMid = () => {
    const [a, b] = [...g.pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  /** Lo que se desplaza: la columna en vertical, la página actual en los otros modos. */
  const panTarget = () =>
    mode === 'vertical'
      ? scroller.current
      : (track.current?.querySelector<HTMLElement>('[data-where="0"]') ?? null);
  const canPan = (el: HTMLElement | null) =>
    !!el && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2);
  const endPinch = () => {
    g.pinch = null;
    setZoom(g.z < 1.05 ? 1 : Math.round(g.z * 100) / 100);
  };

  // Fase de captura: lleva la cuenta de todos los dedos, aunque la capa de anotaciones corte el
  // evento para dibujar, y maneja los gestos de dos dedos (pellizco y arrastre).
  const onPointerDownCapture = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pointers.size !== 2) return;
    clearTimeout(g.longTimer);
    g.pinch = { dist: pinchDist(), zoom, mid: pinchMid() };
    g.z = zoom;
    g.start = null;
    if (g.swiping) setTrack(0, true);
    g.swiping = g.panning = false;
  };

  const onPointerMoveCapture = (e: React.PointerEvent) => {
    if (!g.pointers.has(e.pointerId)) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!g.pinch || g.pointers.size < 2) return;
    g.z = Math.min(4, Math.max(1, (g.pinch.zoom * pinchDist()) / g.pinch.dist));
    stage.current!.style.setProperty('--z', String(g.z));
    // Con touch-action normal el navegador ya mueve la página con dos dedos; acá solo hace
    // falta cuando lo tenemos desactivado (anotando o con zoom).
    const mid = pinchMid();
    const el = panTarget();
    if (manualPan && el) {
      el.scrollLeft -= mid.x - g.pinch.mid.x;
      el.scrollTop -= mid.y - g.pinch.mid.y;
    }
    g.pinch.mid = mid;
  };

  const onPointerEndCapture = (e: React.PointerEvent) => {
    if (!g.pointers.delete(e.pointerId)) return;
    if (g.pinch && g.pointers.size < 2) endPinch();
  };

  // Fase de burbuja: gestos de un dedo (toque, deslizar la hoja, mover la página). No llegan acá
  // los trazos, porque la capa de anotaciones corta el evento.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (g.pointers.size !== 1) return;
    clearTimeout(g.longTimer);
    finishAnim();
    g.start = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    g.last = { x: e.clientX, y: e.clientY };
    g.moved = g.swiping = g.panning = false;
    g.over = 0;
    if (p.prefs.tapZones === 'halves')
      g.longTimer = window.setTimeout(() => {
        g.start = null;
        p.onCenterTap();
      }, 500);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (g.pinch || !g.start || g.start.id !== e.pointerId) return;
    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) > 10) {
      g.moved = true;
      clearTimeout(g.longTimer);
      g.panning = manualPan && e.pointerType !== 'mouse' && canPan(panTarget());
      g.swiping = !g.panning && sliding && Math.abs(dx) > Math.abs(dy);
    }
    if (g.panning) {
      const el = panTarget()!;
      const mx = e.clientX - g.last.x;
      const left = el.scrollLeft;
      el.scrollLeft -= mx;
      el.scrollTop -= e.clientY - g.last.y;
      g.over += mx - (left - el.scrollLeft);
    } else if (g.swiping) {
      const view = latest.current.view;
      const hasTarget = dx < 0 ? nextView(view, seq) : prevView(view, seq);
      g.dx = hasTarget ? dx : dx * 0.25; // sin página de ese lado, la hoja se resiste
      setTrack(g.dx, false);
    }
    g.last = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: React.PointerEvent) => {
    clearTimeout(g.longTimer);
    const start = g.start;
    if (!start || start.id !== e.pointerId) return;
    g.start = null;
    if (g.panning) {
      g.panning = false;
      // Con zoom, arrastrar más allá del borde de la página pasa de hoja.
      if (zoom > 1 && mode !== 'vertical' && Math.abs(g.over) > box.w * 0.15) {
        const dir = g.over < 0 ? 1 : -1;
        const view = latest.current.view;
        const target = dir === 1 ? nextView(view, seq) : prevView(view, seq);
        if (target) turn(dir, target);
        else p.onEdge?.(dir);
      }
      return;
    }
    if (g.swiping) {
      g.swiping = false;
      const dir = g.dx < 0 ? 1 : -1;
      const view = latest.current.view;
      const target = dir === 1 ? nextView(view, seq) : prevView(view, seq);
      if (target && Math.abs(g.dx) > box.w * 0.2) turn(dir, target);
      else {
        setTrack(0, true);
        if (!target && Math.abs(g.dx) > box.w * 0.05) p.onEdge?.(dir);
      }
      return;
    }
    if (g.moved || performance.now() - start.t > 500) return;
    tap(e.clientX);
  };

  const onPointerCancel = () => {
    clearTimeout(g.longTimer);
    g.start = null;
    if (g.swiping) setTrack(0, true);
    g.swiping = g.panning = false;
  };

  const tap = (x: number) => {
    if (p.interceptTap?.()) return;
    const rect = stage.current!.getBoundingClientRect();
    const rel = (x - rect.left) / rect.width;
    if (p.prefs.tapZones === 'halves') return go(rel < 0.5 ? -1 : 1);
    if (rel < 1 / 3) return go(-1);
    if (rel > 2 / 3) return go(1);
    // ponytail: el doble toque solo se detecta en el tercio central, para que pasar página
    // en los costados no espere los 300 ms de desambiguación.
    const now = performance.now();
    clearTimeout(g.tapTimer);
    if (now - g.lastCenterTap < 300) {
      g.lastCenterTap = -Infinity;
      toggleFit();
    } else {
      g.lastCenterTap = now;
      g.tapTimer = window.setTimeout(p.onCenterTap, 300);
    }
  };

  // --- Modo vertical ---

  const vertical = useMemo(() => {
    if (mode !== 'vertical' || !box.w) return null;
    let top = 0;
    const pages = p.order.map((_, pos) => {
      const b = pageBox(pos);
      const out = { ...b, top };
      top += b.h + GAP;
      return out;
    });
    return { pages, total: top - GAP };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, box.w, box.h, fit, p.order, p.sizes, p.crop]);

  const selfPos = useRef(-1); // última posición que informó el propio scroll
  useEffect(() => {
    if (!vertical || p.view.pos === selfPos.current) return;
    selfPos.current = p.view.pos;
    scroller.current!.scrollTop = vertical.pages[p.view.pos].top * zoom;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertical, p.view.pos]);

  // Va después del efecto de view.pos, que deja el scroll al tope de la página.
  const targetNonce = p.scrollTarget?.nonce;
  useEffect(() => {
    const target = p.scrollTarget;
    const pg = target && vertical?.pages[target.pos];
    if (!target || !pg) return;
    const size = p.sizes[p.order[target.pos]];
    const geo = pageGeometry(size, p.crop, pg.w);
    const y = pg.top + Math.max(0, target.y * geo.fullH - geo.top) - box.h * 0.2;
    scroller.current!.scrollTop = Math.max(0, y) * zoom;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetNonce, vertical]);

  const onScroll = () => {
    if (!vertical) return;
    const y = (scroller.current!.scrollTop + box.h * 0.3) / zoom;
    let pos = vertical.pages.findIndex((pg) => pg.top + pg.h + GAP > y);
    if (pos < 0) pos = count - 1;
    if (pos !== selfPos.current) {
      selfPos.current = pos;
      p.onView({ pos, half: false });
    }
  };

  useEffect(() => {
    if (!p.autoscroll || mode !== 'vertical') return;
    const el = scroller.current!;
    let last = performance.now();
    let acc = 0;
    let raf = requestAnimationFrame(function step(now) {
      acc += (p.autoscroll! * (now - last)) / 1000;
      last = now;
      const whole = Math.floor(acc);
      el.scrollTop += whole;
      acc -= whole;
      raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [p.autoscroll, mode]);

  // --- Render ---

  const zoomVars = (w: number, h: number) => ({ '--bw': w, '--bh': h }) as CSSProperties;

  const slot = (v: View, where: -1 | 0 | 1) => {
    const pages =
      mode === 'two-up'
        ? [v.pos, v.pos + 1].filter((i) => i < count).map((i) => pageBox(i, 2))
        : [pageBox(v.pos)];
    const w = pages.reduce((sum, pg) => sum + pg.w, 0);
    const h = Math.max(...pages.map((pg) => pg.h));
    const half = v.half && v.pos + 1 < count ? pageBox(v.pos + 1) : null;
    return (
      <div
        key={`${v.pos}:${v.half}`}
        className="reader-slot"
        data-where={where}
        style={{
          left: `${where * 100}%`,
          touchAction: !manualPan && fit === 'width' ? 'pan-y' : 'none',
        }}
      >
        <div className="zoom-sizer" style={zoomVars(w, h)}>
          <div className="zoom-inner">
            {pages.map(renderPageAt)}
            {half && (
              <div className="half-top" style={{ height: h / 2 }}>
                {renderPageAt(half)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const prev = sliding ? prevView(p.view, seq) : null;
  const shown = mode === 'two-up' ? Math.min(p.view.pos + 2, count) : p.view.pos + 1;

  return (
    <div
      ref={stage}
      className={`reader-stage theme-${p.prefs.theme}`}
      style={{ '--z': zoom } as CSSProperties}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMoveCapture={onPointerMoveCapture}
      onPointerUpCapture={onPointerEndCapture}
      onPointerCancelCapture={onPointerEndCapture}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {box.w > 0 &&
        (vertical ? (
          <div
            ref={scroller}
            className="reader-scroll"
            onScroll={onScroll}
            style={{ touchAction: manualPan ? 'none' : 'pan-y' }}
          >
            <div className="zoom-sizer" style={zoomVars(box.w, vertical.total)}>
              <div className="zoom-inner vertical">
                {vertical.pages.map((pg) => (
                  <div key={pg.pos} className="vpage" style={{ top: pg.top, height: pg.h }}>
                    {Math.abs(pg.pos - p.view.pos) <= 1 && renderPageAt(pg)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div ref={track} className="reader-track">
            {prev && slot(prev, -1)}
            {slot(p.view, 0)}
            {sliding && next && slot(next, 1)}
          </div>
        ))}
      <div className="page-indicator" aria-live="polite">
        {mode === 'two-up' && shown > p.view.pos + 1 ? `${p.view.pos + 1}–${shown}` : shown} /{' '}
        {count}
      </div>
    </div>
  );
}
