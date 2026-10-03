import { expect, test } from 'vitest';
import type { PageAnnotations, Stroke } from '../../core/db/types';
import { eraseAt, hitsStroke, strokePath } from './strokes';

const stroke = (id: string, y: number): Stroke => ({
  id,
  tool: 'pen',
  color: '#000',
  width: 0.004,
  points: [
    [0.1, y, 0.5],
    [0.2, y, 0.5],
    [0.3, y, 0.5],
  ],
});

test('el path sale en coordenadas del viewBox, sin depender del tamaño de pantalla', () => {
  const d = strokePath(stroke('a', 0.5), 1.4);
  expect(d.startsWith('M')).toBe(true);
  const ys = [...d.matchAll(/[ML][\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]));
  // y = 0.5 con aspect 1.4 cae alrededor de 700 en un viewBox de 1000 de ancho
  expect(Math.min(...ys)).toBeGreaterThan(690);
  expect(Math.max(...ys)).toBeLessThan(710);
});

test('la goma borra el trazo que toca y deja el resto', () => {
  const a: PageAnnotations = {
    id: 's:0',
    scoreId: 's',
    page: 0,
    strokes: [stroke('a', 0.2), stroke('b', 0.6)],
    texts: [{ id: 't', x: 0.5, y: 0.9, text: 'respirar', color: '#000', size: 0.028 }],
    updatedAt: 0,
  };
  expect(hitsStroke(a.strokes[0], 0.2, 0.205, 1.4, 0.012)).toBe(true);
  expect(hitsStroke(a.strokes[0], 0.2, 0.3, 1.4, 0.012)).toBe(false);
  expect(hitsStroke(a.strokes[0], 0.25, 0.2, 1.4, 0.012)).toBe(true); // entre dos puntos
  expect(eraseAt(a, 0.2, 0.2, 1.4).strokes.map((s) => s.id)).toEqual(['b']);
  expect(eraseAt(a, 0.55, 0.89, 1.4).texts).toEqual([]);
  expect(eraseAt(a, 0.9, 0.1, 1.4)).toBe(a);
});
