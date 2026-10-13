import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { getScoreMarkers } from '../../core/db/queries';
import type { Bookmark, JumpLink } from '../../core/db/types';
import { Icon } from '../../ui/Icon';

export interface PagePoint {
  page: number;
  x: number;
  y: number;
}

/** El marcador al que apunta un salto, si su destino coincide con alguno. */
export const bookmarkAt = (bookmarks: Bookmark[], to: JumpLink['to']) =>
  bookmarks.find((b) => b.page === to.page && b.y === to.y && b.x !== undefined);

const FLAG_ROOM = 0.05; // fracción del alto de página que ocupa una banderita, con margen

interface Props {
  scoreId: string;
  page: number; // página real
  placing: boolean; // se está eligiendo un punto (marcador o salto nuevo)
  highlight?: string; // id del marcador al que se acaba de saltar
  jumpLabel: (target: string) => string;
  pageLabel: (page: number) => string; // para el nombre accesible ("página 3")
  pageShort: (page: number) => string; // para lo que se ve ("p. 3")
  placeLabel: string;
  onJump: (link: JumpLink) => void;
  onPlace: (point: PagePoint) => void;
  movable: boolean; // anotando: mantener apretada una banderita la arrastra
  onMove: (id: string, x: number, y: number) => void;
}

const HOLD_MS = 500; // el mismo tiempo que para agarrar lo anotado
const DRAG_SLOP = 8; // px
const round = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 10000) / 10000;

/** Banderitas de marcadores y botones de salto sobre la página. */
export function PageMarkers(p: Props) {
  const data = useLiveQuery(() => getScoreMarkers(p.scoreId), [p.scoreId]);
  const bookmarks = data?.bookmarks ?? [];
  // Banderita que se arrastra, y dónde va. Queda hasta que la base devuelve la posición nueva,
  // para que no vuelva atrás por un instante al soltarla.
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; done?: boolean }>();
  // El gesto en curso. Va en un ref y no en el estado: los eventos pueden llegar antes de que
  // React vuelva a dibujar, y el pointerup tiene que ver la última posición.
  const hold = useRef<{
    timer: number;
    cx: number;
    cy: number;
    x: number;
    y: number;
    to?: { x: number; y: number }; // agarrado: adónde va
  }>(null);
  useEffect(() => {
    const b = data?.bookmarks.find((b) => b.id === drag?.id);
    if (drag?.done && b?.x === drag.x && b.y === drag.y) setDrag(undefined);
  }, [data, drag]);

  const press = (b: Bookmark) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (!p.movable) return;
      e.stopPropagation(); // no es un trazo ni un toque de la página
      e.currentTarget.setPointerCapture(e.pointerId);
      const start = { id: b.id, x: b.x!, y: b.y };
      hold.current = {
        timer: window.setTimeout(() => {
          hold.current!.to = { x: start.x, y: start.y };
          setDrag(start);
          navigator.vibrate?.(15);
        }, HOLD_MS),
        cx: e.clientX,
        cy: e.clientY,
        ...start,
      };
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const h = hold.current;
      if (!h) return;
      e.stopPropagation();
      if (!h.to) {
        if (Math.hypot(e.clientX - h.cx, e.clientY - h.cy) > DRAG_SLOP) {
          clearTimeout(h.timer);
          hold.current = null;
        }
        return;
      }
      const r = e.currentTarget.parentElement!.getBoundingClientRect();
      h.to = {
        x: round(h.x + (e.clientX - h.cx) / r.width),
        y: round(h.y + (e.clientY - h.cy) / r.height),
      };
      setDrag({ id: b.id, ...h.to });
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const h = hold.current;
      if (!h) return;
      e.stopPropagation();
      clearTimeout(h.timer);
      hold.current = null;
      const to = h.to;
      if (!to) return;
      if (e.type === 'pointerup' && (to.x !== b.x || to.y !== b.y)) {
        setDrag({ id: b.id, ...to, done: true });
        p.onMove(b.id, to.x, to.y);
      } else setDrag(undefined);
    },
  });

  return (
    <div className="marker-layer" data-movable={p.movable || undefined}>
      {bookmarks
        .filter((b) => b.page === p.page && b.x !== undefined)
        .map((b) => {
          const at = drag?.id === b.id ? drag : { x: b.x!, y: b.y };
          const handlers = press(b);
          return (
            <span
              key={b.id}
              className="bookmark-flag"
              title={b.label}
              data-highlight={b.id === p.highlight || undefined}
              data-dragging={(drag?.id === b.id && !drag.done) || undefined}
              // Cerca del borde superior la banderita va debajo del punto: arriba quedaría fuera
              // de la página (que recorta lo que sobresale).
              data-below={at.y < FLAG_ROOM || undefined}
              style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
              {...handlers}
              onPointerCancel={handlers.onPointerUp}
            >
              <Icon name="bookmark" size={12} />
              <span>{b.label}</span>
            </span>
          );
        })}
      {data?.links
        .filter((l) => l.from.page === p.page)
        .map((link) => {
          const bookmark = bookmarkAt(bookmarks, link.to)?.label;
          const page = link.to.page + 1;
          // Se ve una píldora chica; el botón alrededor es transparente y mide 44 px para tocarlo.
          return (
            <button
              key={link.id}
              className="jump-marker"
              style={{ left: `${link.from.x * 100}%`, top: `${link.from.y * 100}%` }}
              aria-label={p.jumpLabel(bookmark ?? p.pageLabel(page))}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => p.onJump(link)}
            >
              <span className="jump-dot">
                <Icon name="right" size={12} />
                <span>{bookmark ?? p.pageShort(page)}</span>
              </span>
            </button>
          );
        })}
      {p.placing && (
        <button
          className="place-point"
          aria-label={p.placeLabel}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            p.onPlace({
              page: p.page,
              x: (e.clientX - r.left) / r.width,
              y: (e.clientY - r.top) / r.height,
            });
          }}
        />
      )}
    </div>
  );
}
