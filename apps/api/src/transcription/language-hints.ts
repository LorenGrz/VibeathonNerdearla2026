import type { Glossary, LanguageCodeValue } from '@subs/domain';

/**
 * BCP-47 hints for `inputAudioTranscription.languageCodes` (codes taken from the
 * `gemini-3.5-transcribe-live` supported-language table). Spanish uses Latin America.
 */
export const LIVE_LANGUAGE_CODES: Record<LanguageCodeValue, string> = {
  en: 'en-US',
  es: 'es-419',
  pt: 'pt-BR',
};

export const LANGUAGE_NAMES: Record<LanguageCodeValue, string> = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
};

/** Docs: up to 1,000 terms accepted, best results with up to 100. */
export const MAX_VOCABULARY_TERMS = 100;

/** Glossary source terms, de-duplicated, for ASR biasing / prompt hints. */
export function vocabularyFrom(glossary: Glossary): string[] {
  const terms = glossary.terms().map((t) => t.source.trim());
  return [...new Set(terms.filter((t) => t.length > 0))].slice(0, MAX_VOCABULARY_TERMS);
}

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
