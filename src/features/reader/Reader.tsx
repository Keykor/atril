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
    // Ajuste al ancho: la página es más alta que la pantalla, primero se recorre.
    const slot = track.current?.querySelector<HTMLElement>('[data-where="0"]');
    if (slot && slot.scrollHeight > slot.clientHeight + 4) {
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
    start: null as { x: number; y: number; t: number } | null,
    moved: false,
    swiping: false,
    dx: 0,
    pinch: null as { dist: number; zoom: number } | null,
    z: 1,
    longTimer: 0,
    tapTimer: 0,
    lastCenterTap: -Infinity,
  }).current;

  const pinchDist = () => {
    const [a, b] = [...g.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    clearTimeout(g.longTimer);
    if (g.pointers.size === 2) {
      g.pinch = { dist: pinchDist(), zoom };
      g.z = zoom;
      g.start = null;
      if (g.swiping) setTrack(0, true);
      g.swiping = false;
      return;
    }
    if (g.pointers.size > 2) return;
    finishAnim();
    g.start = { x: e.clientX, y: e.clientY, t: performance.now() };
    g.moved = g.swiping = false;
    if (p.prefs.tapZones === 'halves')
      g.longTimer = window.setTimeout(() => {
        g.start = null;
        p.onCenterTap();
      }, 500);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!g.pointers.has(e.pointerId)) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pinch && g.pointers.size >= 2) {
      g.z = Math.min(4, Math.max(1, (g.pinch.zoom * pinchDist()) / g.pinch.dist));
      stage.current!.style.setProperty('--z', String(g.z));
      return;
    }
    if (!g.start) return;
    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) > 10) {
      g.moved = true;
      clearTimeout(g.longTimer);
      g.swiping = sliding && Math.abs(dx) > Math.abs(dy);
    }
    if (g.swiping) {
      const view = latest.current.view;
      const hasTarget = dx < 0 ? nextView(view, seq) : prevView(view, seq);
      g.dx = hasTarget ? dx : dx * 0.25; // sin página de ese lado, la hoja se resiste
      setTrack(g.dx, false);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!g.pointers.delete(e.pointerId)) return;
    clearTimeout(g.longTimer);
    if (g.pinch) {
      if (g.pointers.size < 2) {
        g.pinch = null;
        setZoom(g.z < 1.05 ? 1 : Math.round(g.z * 100) / 100);
      }
      return;
    }
    const start = g.start;
    g.start = null;
    if (!start) return;
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

  const onPointerCancel = (e: React.PointerEvent) => {
    g.pointers.delete(e.pointerId);
    clearTimeout(g.longTimer);
    g.start = null;
    if (g.pointers.size < 2 && g.pinch) {
      g.pinch = null;
      setZoom(g.z < 1.05 ? 1 : Math.round(g.z * 100) / 100);
    }
    if (g.swiping) setTrack(0, true);
    g.swiping = false;
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
      setFitOverride(fit === 'page' ? 'width' : 'page');
      setZoom(1);
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
          touchAction: zoom > 1 ? 'pan-x pan-y' : fit === 'width' ? 'pan-y' : 'none',
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
            style={{ touchAction: zoom > 1 ? 'pan-x pan-y' : 'pan-y' }}
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
