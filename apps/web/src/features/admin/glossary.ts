import type { GlossaryTermDto, LanguageCodeValue } from '@subs/domain';

export interface GlossaryLine {
  source: string;
  translation: string;
}

/**
 * Parses the "Glosario" textarea, one term per line in the shape `término = traducción`.
 * Blank lines and lines without `=`, or with an empty source/translation, are skipped.
 */
export function parseGlossary(input: string): GlossaryLine[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.includes('='))
    .map((line) => {
      const [source, ...rest] = line.split('=');
      return { source: source.trim(), translation: rest.join('=').trim() };
    })
    .filter((entry) => entry.source.length > 0 && entry.translation.length > 0);
}

/** Applies the same translation to every selected target language (the form has no per-language input). */
export function toGlossaryDto(
  lines: GlossaryLine[],
  targetLanguages: LanguageCodeValue[],
): GlossaryTermDto[] {
  return lines.map(({ source, translation }) => ({
    source,
    translations: Object.fromEntries(targetLanguages.map((lang) => [lang, translation])) as Partial<
      Record<LanguageCodeValue, string>
    >,
  }));
}
