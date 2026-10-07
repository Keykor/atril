import { describe, expect, it } from 'vitest';
import { detectLanguage } from './language';

describe('detectLanguage', () => {
  it('elige español para cualquier variante de es', () => {
    expect(detectLanguage(['es-AR', 'en'])).toBe('es');
    expect(detectLanguage(['ES'])).toBe('es');
  });
  it('elige el primero entre español e inglés', () => {
    expect(detectLanguage(['en-US', 'es'])).toBe('en');
    expect(detectLanguage(['pt-BR', 'es-419', 'en'])).toBe('es');
  });
  it('sin español ni inglés, inglés', () => {
    expect(detectLanguage(['fr-FR', 'de'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
    expect(detectLanguage(['estonian-ish'])).toBe('en');
  });
});
