import { expect, test } from 'vitest';
import type { PageAnnotations, Stamp } from '../../core/db/types';
import { eraseAt } from './strokes';
import { hitsStamp, stampGeometry, SYMBOLS, symbolById } from './symbols';

const stamp = (symbol: string, x = 0.5, y = 0.5): Stamp => ({
  id: symbol,
  symbol,
  x,
  y,
  size: 0.04,
  color: '#000',
});

test('cada símbolo tiene un glifo SMuFL del área privada de Unicode', () => {
  expect(SYMBOLS).toHaveLength(23);
  for (const s of SYMBOLS) expect(s.char.codePointAt(0)).toBeGreaterThanOrEqual(0xe000);
  expect(symbolById('noteQuarterUp')?.char).toBe('');
});

test('la nota se ancla en la cabeza y el resto en su centro', () => {
  const aspect = 1.4;
  // Negra: la línea de base del glifo pasa por el punto tocado (la cabeza).
  const n = stampGeometry(stamp('noteQuarterUp'), aspect);
  expect(n.originY).toBeCloseTo(0.5 * aspect);
  expect(n.box.top).toBeLessThan(n.originY - 0.03); // la plica sube
  // Forte: la caja queda centrada en el punto tocado.
  const f = stampGeometry(stamp('dynamicForte'), aspect);
  expect((f.box.left + f.box.right) / 2).toBeCloseTo(0.5);
  expect((f.box.top + f.box.bottom) / 2).toBeCloseTo(0.5 * aspect);
});

test('se toca y se borra un símbolo; lo de al lado queda', () => {
  const s = stamp('accidentalSharp');
  expect(hitsStamp(s, 0.5, 0.5, 1.4, 0)).toBe(true);
  expect(hitsStamp(s, 0.6, 0.5, 1.4, 0)).toBe(false);

  const a: PageAnnotations = {
    id: 's:0',
    scoreId: 's',
    page: 0,
    strokes: [],
    texts: [],
    stamps: [s, stamp('dynamicPiano', 0.8, 0.8)],
    updatedAt: 0,
  };
  expect(eraseAt(a, 0.5, 0.5, 1.4).stamps?.map((x) => x.symbol)).toEqual(['dynamicPiano']);
  expect(eraseAt(a, 0.1, 0.1, 1.4)).toBe(a);
  // Las anotaciones de antes de los símbolos no tienen el campo y siguen funcionando.
  const old = { ...a, stamps: undefined };
  expect(eraseAt(old, 0.5, 0.5, 1.4)).toBe(old);
});
