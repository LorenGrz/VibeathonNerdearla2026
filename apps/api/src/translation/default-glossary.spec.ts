import { LanguageCode } from '@subs/domain';
import { DEFAULT_GLOSSARY_TERMS, defaultGlossary } from './default-glossary.js';

describe('defaultGlossary', () => {
  it('has at least 20 terms', () => {
    expect(DEFAULT_GLOSSARY_TERMS.length).toBeGreaterThanOrEqual(20);
  });

  it('renders a prompt section covering the terms for a target language', () => {
    const section = defaultGlossary.toPromptSection(LanguageCode.of('es'));

    expect(section).toContain('Nerdearla');
    expect(section).toContain('Kubernetes');
    expect(section).toContain('pull request');
  });
});
