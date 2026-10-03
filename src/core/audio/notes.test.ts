import { expect, test } from 'vitest';
import { formatStartNotes, midiToFreq, midiToLabel, parseNote, parseStartNotes } from './notes';

test('parsea notas en solfeo y en letras', () => {
  expect(parseNote('La4')).toBe(69);
  expect(parseNote('A4')).toBe(69);
  expect(parseNote('do#4')).toBe(61);
  expect(parseNote('Sib3')).toBe(58);
  expect(parseNote('Bb3')).toBe(58);
  expect(parseNote('B3')).toBe(59);
  expect(parseNote('fa')).toBe(65);
  expect(parseNote('hola')).toBeUndefined();
  expect(midiToLabel(53)).toBe('Fa3');
  expect(midiToFreq(69)).toBe(440);
});

test('notas de inicio por voz o como acorde, ida y vuelta', () => {
  const satb = parseStartNotes('S: Fa4, A: Do4, T: La3, B: Fa3');
  expect(satb).toEqual([
    { label: 'S', notes: ['F4'] },
    { label: 'A', notes: ['C4'] },
    { label: 'T', notes: ['A3'] },
    { label: 'B', notes: ['F3'] },
  ]);
  expect(formatStartNotes(satb)).toBe('S: Fa4, A: Do4, T: La3, B: Fa3');
  expect(parseStartNotes('Fa3 La3 Do4')).toEqual([{ label: undefined, notes: ['F3', 'A3', 'C4'] }]);
  expect(parseStartNotes('')).toEqual([]);
});
