import { getStroke } from 'perfect-freehand';
import type { PageAnnotations, StickyNote, Stroke, TextNote } from '../../core/db/types';
import { hitsStamp } from './symbols';

export type Tool = 'pen' | 'highlighter' | 'text' | 'note' | 'eraser' | 'stamp';
export interface ToolState {
  tool: Tool;
  color: string;
  width: number; // índice en WIDTHS (y en STAMP_SIZES para los símbolos)
  symbol: string; // símbolo elegido para la herramienta 'stamp'
  textBg: boolean; // los textos nuevos van con fondo blanco
}

// El blanco tapa: sirve para tachar o "borrar" algo impreso (con el resaltador no se ve).
export const COLORS = ['#17181C', '#D7352B', '#2950C7', '#15803D', '#FFD43B', '#FFFFFF'] as const;
// Grosores como fracción del ancho de página: se ven igual en tablet y en celular.
export const WIDTHS = [0.002, 0.004, 0.007] as const;
export const HIGHLIGHTER_FACTOR = 5;
export const TEXT_SIZE = 0.028;
export const ERASER_RADIUS = 0.012;
export const NOTE_RADIUS = 0.02; // el ícono de una notita, como fracción del ancho de página

export const VB = 1000; // ancho del viewBox del SVG de cada página

/** Contorno del trazo (un polígono) en un viewBox de VB de ancho y VB*aspect de alto. */
export function strokeOutline(stroke: Stroke, aspect: number) {
  return getStroke(
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
}

/** Trazo -> path SVG en un viewBox de VB de ancho y VB*aspect de alto. */
export function strokePath(stroke: Stroke, aspect: number) {
  const outline = strokeOutline(stroke, aspect);
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

/** ¿El punto (x, y) toca la notita? `radius`, como fracción del ancho de página. */
export const hitsNote = (n: StickyNote, x: number, y: number, aspect: number, radius: number) =>
  Math.hypot(n.x - x, (n.y - y) * aspect) <= radius;

/** ¿El punto (x, y) toca el texto? El ancho es aproximado: la letra es angosta. */
export const hitsText = (n: TextNote, x: number, y: number, aspect: number, radius: number) =>
  x >= n.x - radius &&
  x <= n.x + n.text.length * n.size * 0.45 + radius &&
  Math.abs((y - n.y) * aspect + n.size / 2) <= n.size;

/** Lo que se agarró para moverlo. */
export interface Grab {
  kind: 'strokes' | 'texts' | 'stamps' | 'notes';
  id: string;
}

/** Lo que está debajo del punto, de lo que se ve más arriba a lo de más abajo. */
export function grabAt(
  a: PageAnnotations,
  x: number,
  y: number,
  aspect: number,
  noteRadius: number,
): Grab | undefined {
  const top = <T extends { id: string }>(list: T[] | undefined, hit: (item: T) => boolean) =>
    list?.findLast(hit)?.id;
  const r = ERASER_RADIUS;
  const found: [Grab['kind'], string | undefined][] = [
    ['notes', top(a.notes, (n) => hitsNote(n, x, y, aspect, noteRadius))],
    ['stamps', top(a.stamps, (s) => hitsStamp(s, x, y, aspect, r))],
    ['texts', top(a.texts, (n) => hitsText(n, x, y, aspect, r))],
    ['strokes', top(a.strokes, (s) => hitsStroke(s, x, y, aspect, r))],
  ];
  const [kind, id] = found.find(([, id]) => id) ?? [];
  return kind && id ? { kind, id } : undefined;
}

export const round = (n: number) => Math.round(n * 10000) / 10000;
export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Corre lo agarrado (dx, dy) en fracciones de la página. Lo anclado a un punto no sale de ella. */
export function moveGrab(a: PageAnnotations, grab: Grab, dx: number, dy: number): PageAnnotations {
  const shift = <T extends { id: string; x: number; y: number }>(o: T): T =>
    o.id === grab.id ? { ...o, x: round(clamp01(o.x + dx)), y: round(clamp01(o.y + dy)) } : o;
  switch (grab.kind) {
    case 'strokes':
      return {
        ...a,
        strokes: a.strokes.map((s) =>
          s.id === grab.id
            ? { ...s, points: s.points.map(([x, y, p]) => [round(x + dx), round(y + dy), p]) }
            : s,
        ),
      };
    case 'texts':
      return { ...a, texts: a.texts.map(shift) };
    case 'stamps':
      return { ...a, stamps: a.stamps?.map(shift) };
    case 'notes':
      return { ...a, notes: a.notes?.map(shift) };
  }
}

/** Borra por trazo (y los textos y símbolos cercanos; los recordatorios no, a propósito). Devuelve el mismo objeto si no tocó nada. */
export function eraseAt(a: PageAnnotations, x: number, y: number, aspect: number): PageAnnotations {
  const strokes = a.strokes.filter((s) => !hitsStroke(s, x, y, aspect, ERASER_RADIUS));
  const texts = a.texts.filter((n) => !hitsText(n, x, y, aspect, ERASER_RADIUS));
  const stamps = a.stamps?.filter((s) => !hitsStamp(s, x, y, aspect, ERASER_RADIUS));
  return strokes.length === a.strokes.length &&
    texts.length === a.texts.length &&
    (stamps?.length ?? 0) === (a.stamps?.length ?? 0)
    ? a
    : { ...a, strokes, texts, stamps };
}
