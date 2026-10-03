import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../core/db/db';
import type { JumpLink } from '../../core/db/types';
import { Icon } from '../../ui/Icon';

interface Props {
  scoreId: string;
  page: number; // página real
  placing: boolean; // se está eligiendo el origen de un salto nuevo
  jumpLabel: (toPage: number) => string;
  placeLabel: string;
  onJump: (link: JumpLink) => void;
  onPlace: (from: JumpLink['from']) => void;
}

/** Saltos (D.S., coda, repeticiones) sobre la página: tocar el origen lleva al destino. */
export function JumpMarkers({
  scoreId,
  page,
  placing,
  jumpLabel,
  placeLabel,
  onJump,
  onPlace,
}: Props) {
  const links =
    useLiveQuery(() => db.links.where('scoreId').equals(scoreId).toArray(), [scoreId])?.filter(
      (l) => l.from.page === page,
    ) ?? [];

  return (
    <div className="jump-layer">
      {links.map((link) => (
        <button
          key={link.id}
          className="jump-marker"
          style={{ left: `${link.from.x * 100}%`, top: `${link.from.y * 100}%` }}
          aria-label={jumpLabel(link.to.page + 1)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onJump(link)}
        >
          <Icon name="right" size={16} />
          {link.to.page + 1}
        </button>
      ))}
      {placing && (
        <button
          className="jump-place"
          aria-label={placeLabel}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            onPlace({
              page,
              x: (e.clientX - r.left) / r.width,
              y: (e.clientY - r.top) / r.height,
            });
          }}
        />
      )}
    </div>
  );
}
