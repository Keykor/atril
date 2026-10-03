import { useLiveQuery } from 'dexie-react-hooks';
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
}

/** Banderitas de marcadores y botones de salto sobre la página. */
export function PageMarkers(p: Props) {
  const data = useLiveQuery(() => getScoreMarkers(p.scoreId), [p.scoreId]);
  const bookmarks = data?.bookmarks ?? [];

  return (
    <div className="marker-layer">
      {bookmarks
        .filter((b) => b.page === p.page && b.x !== undefined)
        .map((b) => (
          <span
            key={b.id}
            className="bookmark-flag"
            title={b.label}
            data-highlight={b.id === p.highlight || undefined}
            // Cerca del borde superior la banderita va debajo del punto: arriba quedaría fuera
            // de la página (que recorta lo que sobresale).
            data-below={b.y < FLAG_ROOM || undefined}
            style={{ left: `${b.x! * 100}%`, top: `${b.y * 100}%` }}
          >
            <Icon name="bookmark" size={12} />
            <span>{b.label}</span>
          </span>
        ))}
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
