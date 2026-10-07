import { expect, test } from 'vitest';
import { pianoPartials } from './engine';

test('piano: los armónicos altos son más suaves y se apagan antes; los graves duran más', () => {
  const la = pianoPartials(69);
  expect(la[0].freq).toBeCloseTo(440, 0);
  for (let i = 1; i < la.length; i++) {
    expect(la[i].amp).toBeLessThan(la[i - 1].amp);
    expect(la[i].tau).toBeLessThan(la[i - 1].tau);
  }
  expect(pianoPartials(36)[0].tau).toBeGreaterThan(pianoPartials(84)[0].tau);
});
