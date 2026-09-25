import { describe, expect, it } from 'vitest';
import { DomainError, InvalidLanguageError } from '../shared/errors.js';
import { LanguageCode, SUPPORTED_LANGUAGES } from './language-code.js';

describe('LanguageCode', () => {
  it.each(SUPPORTED_LANGUAGES)('accepts %s', (code) => {
    expect(LanguageCode.of(code).value).toBe(code);
  });

  it('normalizes case and whitespace', () => {
    expect(LanguageCode.of(' ES ').value).toBe('es');
  });

  it('rejects unsupported languages', () => {
    expect(() => LanguageCode.of('fr')).toThrow(InvalidLanguageError);
    expect(() => LanguageCode.of('fr')).toThrow(DomainError);
  });

  it('is an immutable value object', () => {
    const es = LanguageCode.of('es');
    expect(es.equals(LanguageCode.of('es'))).toBe(true);
    expect(es.equals(LanguageCode.of('en'))).toBe(false);
    expect(String(es)).toBe('es');
    expect(Object.isFrozen(es)).toBe(true);
  });

  it('exposes a type guard', () => {
    expect(LanguageCode.isSupported('pt')).toBe(true);
    expect(LanguageCode.isSupported('de')).toBe(false);
  });
});
