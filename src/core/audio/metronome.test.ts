import { expect, test } from 'vitest';
import { beatsOf, dueBeats, tapTempo, type Beat } from './metronome';

test('el scheduler no deriva en 5 minutos aunque el timer se atrase', () => {
  const state = { start: 10, next: 0, bpm: 72, beats: 4 };
  const beats: Beat[] = [];
  // Ticks irregulares: 25 ms nominales con atrasos de hasta 60 ms.
  for (let now = 10, i = 0; now < 310; now += 0.025 + ((i++ * 37) % 60) / 1000)
    beats.push(...dueBeats(state, now));

  expect(beats.length).toBeGreaterThanOrEqual(360); // 72 BPM * 5 min
  for (const [n, b] of beats.entries()) {
    expect(b.time).toBeCloseTo(10 + (n * 60) / 72, 9);
    expect(b.beat).toBe(n % 4);
  }
});

test('compás y tap tempo', () => {
  expect(beatsOf('3/4')).toBe(3);
  expect(beatsOf('6/8')).toBe(6);
  expect(beatsOf(undefined)).toBe(4);
  expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
  expect(tapTempo([0])).toBeUndefined();
  expect(tapTempo([0, 5000])).toBeUndefined(); // pausa larga: se empieza de nuevo
  expect(tapTempo([0, 5000, 5600, 6200])).toBeUndefined();
  expect(tapTempo([5000, 5600, 6200])).toBe(100);
});
