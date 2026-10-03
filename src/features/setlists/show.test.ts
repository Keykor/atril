import { expect, test } from 'vitest';
import type { SetList } from '../../core/db/types';
import { counts, nextInShow, prevInShow, scoreNumber } from './show';

const list: SetList = {
  id: 'l',
  name: 'Concierto de primavera',
  createdAt: 0,
  updatedAt: 0,
  items: [
    { id: '1', type: 'score', scoreId: 'a' },
    { id: '2', type: 'score', scoreId: 'b' },
    { id: '3', type: 'break', label: 'Intervalo · 15 min' },
    { id: '4', type: 'score', scoreId: 'c' },
  ],
};

test('recorrer una lista con separadores', () => {
  expect(nextInShow(list, 0)).toEqual({ breaks: [], next: { index: 1, scoreId: 'b' } });
  expect(nextInShow(list, 1)).toEqual({
    breaks: ['Intervalo · 15 min'],
    next: { index: 3, scoreId: 'c' },
  });
  expect(nextInShow(list, 3)).toEqual({ breaks: [], next: undefined });
  expect(prevInShow(list, 3)).toBe(1);
  expect(prevInShow(list, 0)).toBeUndefined();
  expect(scoreNumber(list, 3)).toEqual({ n: 3, total: 3 });
  expect(counts(list)).toEqual({ scores: 3, breaks: 1 });
});
