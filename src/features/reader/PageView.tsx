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
  const canvas = useRef<HTMLCanvasElement>(null);
  const g = pageGeometry(size, crop, width);
  const renderWidth = Math.round(g.fullW * quality);

  useEffect(() => {
    let alive = true;
    const paint = (retry: boolean) =>
      renderPage(pdfId, page, renderWidth)
        .then((bitmap) => {
          const c = canvas.current;
          if (!alive || !c) return;
          // Lo anterior queda a la vista hasta acá: sin parpadeo al cambiar de zoom.
          c.width = bitmap.width;
          c.height = bitmap.height;
          c.getContext('2d')!.drawImage(bitmap, 0, 0);
        })
        .catch(() => {
          // El bitmap se desalojó de la cache justo antes de copiarlo: se pide de nuevo una vez.
          if (alive && retry) void paint(false);
        });
    void paint(true);
    return () => {
      alive = false;
    };
  }, [pdfId, page, renderWidth]);

  // Al desmontar se libera la memoria del canvas ya (límite de Safari).
  useEffect(() => {
    const c = canvas.current;
    return () => {
      if (c) c.width = c.height = 1;
    };
  }, []);

  return (
    <div className="page" style={{ width, height: g.h }} data-page={page}>
      <div
        className="page-full"
        style={{ left: -g.left, top: -g.top, width: g.fullW, height: g.fullH }}
      >
        <div className="page-canvas">
          <canvas ref={canvas} />
        </div>
        {children}
      </div>
    </div>
  );
}
