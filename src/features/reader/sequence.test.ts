import { expect, test } from 'vitest';
import {
  croppedAspect,
  nextView,
  pageGeometry,
  parsePageOrder,
  prevView,
  resolveOrder,
  type Seq,
  type View,
} from './sequence';

const walk = (s: Seq) => {
  const seen: string[] = [];
  let v: View | null = { pos: 0, half: false };
  while (v) {
    seen.push(`${v.pos}${v.half ? '½' : ''}`);
    v = nextView(v, s);
  }
  return seen.join(' ');
};
const base: Seq = { count: 3, mode: 'paged', halfPage: false, twoUpStep: 2 };

test('recorrido en cada modo', () => {
  expect(walk(base)).toBe('0 1 2');
  expect(walk({ ...base, halfPage: true })).toBe('0 0½ 1 1½ 2');
  expect(walk({ ...base, mode: 'two-up' })).toBe('0 2');
  expect(walk({ ...base, mode: 'two-up', twoUpStep: 1 })).toBe('0 1');
  expect(walk({ ...base, mode: 'two-up', count: 5 })).toBe('0 2 4');
});

test('retroceder deshace avanzar', () => {
  for (const s of [base, { ...base, halfPage: true }]) {
    let v: View = { pos: 0, half: false };
    for (let n; (n = nextView(v, s)); v = n) expect(prevView(n, s)).toEqual(v);
  }
  expect(prevView({ pos: 0, half: false }, base)).toBeNull();
});

test('orden virtual de páginas', () => {
  expect(parsePageOrder('1, 2, 3, 2, 3, 4', 4)).toEqual([0, 1, 2, 1, 2, 3]);
  expect(parsePageOrder('1-3 2-3 4', 4)).toEqual([0, 1, 2, 1, 2, 3]);
  expect(parsePageOrder('1,2,3', 3)).toBeUndefined(); // orden natural
  expect(parsePageOrder('9, x', 3)).toBeUndefined();
  expect(resolveOrder([0, 5, 1], 2)).toEqual([0, 1]);
  expect(resolveOrder(undefined, 2)).toEqual([0, 1]);
});

test('geometría con recorte', () => {
  const size = { w: 100, h: 200 };
  expect(croppedAspect(size)).toBe(2);
  const g = pageGeometry(size, { top: 0.25, bottom: 0.25, left: 0.1, right: 0.4 }, 50);
  expect(g.fullW).toBeCloseTo(100);
  expect(g.h).toBeCloseTo(100);
  expect(g.left).toBeCloseTo(10);
  expect(g.top).toBeCloseTo(50);
});
