import { useEffect, useRef, type ReactNode } from 'react';
import type { Crop } from '../../core/db/types';
import { renderPage } from '../../core/pdf/render';
import { pageGeometry } from './sequence';

interface Props {
  pdfId: string;
  page: number; // página real del PDF
  size: { w: number; h: number };
  crop?: Crop;
  width: number; // ancho visible en px CSS (ya recortado)
  quality?: number; // multiplicador de resolución (zoom)
  children?: ReactNode; // capas sobre la página completa (anotaciones)
}

/** Una página del PDF. El recorte se hace con CSS: las capas siguen alineadas a la página real. */
export function PageView({ pdfId, page, size, crop, width, quality = 1, children }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const g = pageGeometry(size, crop, width);
  const renderWidth = Math.round(g.fullW * quality);

  useEffect(() => {
    let alive = true;
    renderPage(pdfId, page, renderWidth)
      .then((canvas) => {
        // El canvas viejo queda a la vista hasta que llega el nuevo: sin parpadeo al cambiar de zoom.
        if (alive) host.current?.replaceChildren(canvas);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pdfId, page, renderWidth]);

  return (
    <div className="page" style={{ width, height: g.h }} data-page={page}>
      <div
        className="page-full"
        style={{ left: -g.left, top: -g.top, width: g.fullW, height: g.fullH }}
      >
        <div className="page-canvas" ref={host} />
        {children}
      </div>
    </div>
  );
}
