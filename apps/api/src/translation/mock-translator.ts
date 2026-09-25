import type { Glossary, LanguageCode, TranscriptSegment, TranslatorPort } from '@subs/domain';

/** `TRANSLATOR=mock`: prefixes the original text with `[<target>] ` instead of calling Gemini. */
export class MockTranslator implements TranslatorPort {
  async translate(
    segment: TranscriptSegment,
    target: LanguageCode,
    _glossary: Glossary,
  ): Promise<TranscriptSegment> {
    if (segment.language.equals(target)) return segment;
    return await Promise.resolve(segment.translate(target, `[${target.value}] ${segment.text}`));
  }
}
