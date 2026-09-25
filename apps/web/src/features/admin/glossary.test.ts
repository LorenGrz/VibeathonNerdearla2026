import { describe, expect, it } from 'vitest';
import { parseGlossary, toGlossaryDto } from './glossary';

describe('parseGlossary', () => {
  it('parses "term = translation" lines, trimming whitespace', () => {
    const result = parseGlossary('  Nerdearla = Nerdearla \nOverlay=Superposición\n');
    expect(result).toEqual([
      { source: 'Nerdearla', translation: 'Nerdearla' },
      { source: 'Overlay', translation: 'Superposición' },
    ]);
  });

  it('ignores blank lines and lines without "="', () => {
    const result = parseGlossary('\n  \nsin igual\nfoo = bar');
    expect(result).toEqual([{ source: 'foo', translation: 'bar' }]);
  });

  it('keeps the remainder after the first "=" when the translation itself contains one', () => {
    const result = parseGlossary('a=b=c');
    expect(result).toEqual([{ source: 'a', translation: 'b=c' }]);
  });

  it('drops entries with an empty source or translation', () => {
    const result = parseGlossary('= sin fuente\nsin traduccion =');
    expect(result).toEqual([]);
  });
});

describe('toGlossaryDto', () => {
  it('applies the same translation to every selected target language', () => {
    const dto = toGlossaryDto([{ source: 'foo', translation: 'bar' }], ['es', 'pt']);
    expect(dto).toEqual([{ source: 'foo', translations: { es: 'bar', pt: 'bar' } }]);
  });

  it('returns an empty translations map when no target language is selected', () => {
    const dto = toGlossaryDto([{ source: 'foo', translation: 'bar' }], []);
    expect(dto).toEqual([{ source: 'foo', translations: {} }]);
  });
});
