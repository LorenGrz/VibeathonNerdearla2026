import { describe, expect, it } from 'vitest';
import { LanguageCode } from '../language/language-code.js';
import { Glossary, GlossaryTerm } from './glossary.js';

const es = LanguageCode.of('es');
const pt = LanguageCode.of('pt');

describe('Glossary', () => {
  const glossary = new Glossary([
    new GlossaryTerm('keynote', { es: 'conferencia magistral', pt: 'palestra principal' }),
    new GlossaryTerm('Vibeathon', {}, 'event name'),
    new GlossaryTerm('stage', { es: 'escenario' }),
  ]);

  it('renders a prompt section for the target language', () => {
    expect(glossary.toPromptSection(es)).toBe(
      [
        'Glossary (es). Use these exact renderings:',
        '- "keynote" -> "conferencia magistral"',
        '- "Vibeathon" (keep as-is) — event name',
        '- "stage" -> "escenario"',
      ].join('\n'),
    );
    expect(glossary.toPromptSection(pt)).toContain('- "stage" (keep as-is)');
  });

  it('renders nothing for an empty glossary', () => {
    expect(Glossary.empty().toPromptSection(es)).toBe('');
  });

  it('exposes terms read-only and builds from DTOs', () => {
    expect(Object.isFrozen(glossary.terms())).toBe(true);
    const fromDto = Glossary.fromDto([{ source: 'stage', translations: { es: 'escenario' } }]);
    expect(fromDto.terms()[0]?.equals(new GlossaryTerm('stage', { es: 'escenario' }))).toBe(true);
    expect(fromDto.terms()[0]?.equals(new GlossaryTerm('stage', { es: 'tarima' }))).toBe(false);
  });
});
