import type { Stamp } from '../../core/db/types';

// Símbolos de la fuente Bravura (SMuFL). bbox y ancla en espacios de pentagrama (1 em = 4
// espacios), con y hacia arriba, sacados de metadata.json de @vexflow-fonts/bravura.
// El ancla es el punto del glifo que queda donde se toca: la cabeza en las notas (para
// ponerla sobre una línea), el centro en el resto.
export interface MusicSymbol {
  id: string;
  char: string;
  group: 'notes' | 'rests' | 'accidentals' | 'dynamics' | 'articulations';
  bbox: [x0: number, y0: number, x1: number, y1: number];
  anchor: [x: number, y: number];
}

const centered = (
  id: string,
  code: number,
  group: MusicSymbol['group'],
  bbox: MusicSymbol['bbox'],
): MusicSymbol => ({
  id,
  char: String.fromCodePoint(code),
  group,
  bbox,
  anchor: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
});
const note = (id: string, code: number, bbox: MusicSymbol['bbox'], headWidth: number) => ({
  ...centered(id, code, 'notes', bbox),
  anchor: [headWidth / 2, 0] as [number, number],
});

export const SYMBOLS: MusicSymbol[] = [
  note('noteWhole', 0xe1d2, [0, -0.548, 1.836, 0.544], 1.836),
  note('noteHalfUp', 0xe1d3, [0, -0.58, 1.364, 3.5], 1.18),
  note('noteQuarterUp', 0xe1d5, [0, -0.564, 1.328, 3.5], 1.18),
  note('note8thUp', 0xe1d7, [0, -0.552, 2.264, 3.492], 1.18),
  note('note16thUp', 0xe1d9, [0, -0.552, 2.324, 3.492], 1.18),
  centered('restWhole', 0xe4e3, 'rests', [0, -0.54, 1.128, 0.036]),
  centered('restHalf', 0xe4e4, 'rests', [0, -0.008, 1.128, 0.568]),
  centered('restQuarter', 0xe4e5, 'rests', [0.004, -1.5, 1.08, 1.492]),
  centered('rest8th', 0xe4e6, 'rests', [0, -1.004, 0.988, 0.696]),
  centered('rest16th', 0xe4e7, 'rests', [0, -2, 1.28, 0.716]),
  centered('accidentalSharp', 0xe262, 'accidentals', [0, -1.392, 0.996, 1.4]),
  centered('accidentalFlat', 0xe260, 'accidentals', [0, -0.7, 0.904, 1.756]),
  centered('accidentalNatural', 0xe261, 'accidentals', [0, -1.34, 0.672, 1.364]),
  centered('dynamicPP', 0xe52b, 'dynamics', [-0.328, -0.568, 2.912, 1.096]),
  centered('dynamicPiano', 0xe520, 'dynamics', [-0.356, -0.568, 1.464, 1.096]),
  centered('dynamicMP', 0xe52c, 'dynamics', [-0.08, -0.568, 3.3, 1.096]),
  centered('dynamicMF', 0xe52d, 'dynamics', [-0.08, -0.66, 3.272, 1.724]),
  centered('dynamicForte', 0xe522, 'dynamics', [-0.564, -0.608, 1.456, 1.776]),
  centered('dynamicFF', 0xe52f, 'dynamics', [-0.54, -0.608, 2.44, 1.776]),
  centered('fermataAbove', 0xe4c0, 'articulations', [0.012, -0.012, 2.42, 1.316]),
  centered('articAccentAbove', 0xe4a0, 'articulations', [0, 0.004, 1.356, 0.98]),
  centered('articStaccatoAbove', 0xe4a2, 'articulations', [0, 0, 0.336, 0.336]),
  centered('breathMarkComma', 0xe4ce, 'articulations', [0.004, 0.008, 0.608, 1.004]),
];

export const SYMBOL_GROUPS = [
  'notes',
  'rests',
  'accidentals',
  'dynamics',
  'articulations',
] as const;
const byId = new Map(SYMBOLS.map((s) => [s.id, s]));
export const symbolById = (id: string) => byId.get(id);

// Tamaño de la fuente como fracción del ancho de página. En una partitura A4 típica el
// pentagrama mide entre el 3 % y el 5 % del ancho; el del medio es el más común.
export const STAMP_SIZES = [0.03, 0.04, 0.052] as const;

/**
 * Dónde dibujar el glifo y qué caja ocupa, en unidades de ancho de página (y hacia abajo,
 * multiplicada por `aspect` = alto/ancho, así x e y miden lo mismo).
 */
export function stampGeometry(stamp: Stamp, aspect: number) {
  const sym = symbolById(stamp.symbol);
  const space = stamp.size / 4;
  const [x0, y0, x1, y1] = sym?.bbox ?? [0, -1, 1, 1];
  const [ax, ay] = sym?.anchor ?? [0.5, 0];
  const originX = stamp.x - ax * space;
  const originY = stamp.y * aspect + ay * space; // línea de base del glifo
  return {
    char: sym?.char ?? '?',
    originX,
    originY,
    box: {
      left: originX + x0 * space,
      right: originX + x1 * space,
      top: originY - y1 * space,
      bottom: originY - y0 * space,
    },
  };
}

/** ¿El punto (x, y) normalizado toca el símbolo? Con un margen para dedos y glifos chicos. */
export function hitsStamp(stamp: Stamp, x: number, y: number, aspect: number, margin: number) {
  const { box } = stampGeometry(stamp, aspect);
  const py = y * aspect;
  return (
    x >= box.left - margin &&
    x <= box.right + margin &&
    py >= box.top - margin &&
    py <= box.bottom + margin
  );
}
