import { getStroke } from 'perfect-freehand';
import type { PageAnnotations, Stroke } from '../../core/db/types';

export type Tool = 'pen' | 'highlighter' | 'text' | 'eraser';
export interface ToolState {
  tool: Tool;
  color: string;
  width: number; // índice en WIDTHS
}

export const COLORS = ['#17181C', '#D7352B', '#2950C7', '#15803D', '#FFD43B'] as const;
// Grosores como fracción del ancho de página: se ven igual en tablet y en celular.
export const WIDTHS = [0.002, 0.004, 0.007] as const;
export const HIGHLIGHTER_FACTOR = 5;
export const TEXT_SIZE = 0.028;
export const ERASER_RADIUS = 0.012;

export const VB = 1000; // ancho del viewBox del SVG de cada página

/** Trazo -> path SVG en un viewBox de VB de ancho y VB*aspect de alto. */
export function strokePath(stroke: Stroke, aspect: number) {
  const outline = getStroke(
    stroke.points.map(([x, y, p]) => [x * VB, y * VB * aspect, p]),
    {
      size: stroke.width * VB,
      thinning: stroke.tool === 'pen' ? 0.5 : 0,
      smoothing: 0.5,
      streamline: 0.4,
      // Dedo y mouse informan presión constante: se simula por velocidad.
      simulatePressure: stroke.points.every(([, , p]) => p === stroke.points[0][2]),
    },
  );
  if (!outline.length) return '';
  const d = outline.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`);
  return `${d.join('')}Z`;
}

/** ¿El punto (x, y) normalizado toca el trazo? `aspect` = alto/ancho de la página. */
export function hitsStroke(stroke: Stroke, x: number, y: number, aspect: number, radius: number) {
  const r = radius + stroke.width / 2;
  const py = y * aspect;
  // Distancia a cada segmento, no a cada punto: un trazo rápido tiene puntos muy separados.
  return stroke.points.some(([ax, ay], i) => {
    const [bx, by] = stroke.points[Math.max(0, i - 1)];
    const [x1, y1, x2, y2] = [ax, ay * aspect, bx, by * aspect];
    const len2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    const k = len2
      ? Math.min(1, Math.max(0, ((x - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / len2))
      : 0;
    return Math.hypot(x1 + k * (x2 - x1) - x, y1 + k * (y2 - y1) - py) <= r;
  });
}

/** Borra por trazo (y las notas de texto cercanas). Devuelve el mismo objeto si no tocó nada. */
export function eraseAt(a: PageAnnotations, x: number, y: number, aspect: number): PageAnnotations {
  const strokes = a.strokes.filter((s) => !hitsStroke(s, x, y, aspect, ERASER_RADIUS));
  const texts = a.texts.filter(
    (n) =>
      !(
        x >= n.x - ERASER_RADIUS &&
        x <= n.x + n.text.length * n.size * 0.45 + ERASER_RADIUS &&
        Math.abs((y - n.y) * aspect + n.size / 2) <= n.size
      ),
  );
  return strokes.length === a.strokes.length && texts.length === a.texts.length
    ? a
    : { ...a, strokes, texts };
}
