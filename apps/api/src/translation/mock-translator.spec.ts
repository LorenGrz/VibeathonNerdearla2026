import {
  Glossary,
  LanguageCode,
  SessionId,
  TimeRange,
  TranscriptSegment,
  sequentialIdGenerator,
} from '@subs/domain';
import { MockTranslator } from './mock-translator.js';

describe('MockTranslator', () => {
  const segment = TranscriptSegment.original(
    {
      sessionId: SessionId.of('session-1'),
      language: LanguageCode.of('en'),
      text: 'Hello world',
      range: TimeRange.of(0, 1000),
      isFinal: true,
    },
    sequentialIdGenerator('seg'),
  );

  it('prefixes the translated text with the target language tag', async () => {
    const translator = new MockTranslator();

    const result = await translator.translate(segment, LanguageCode.of('es'), Glossary.empty());

    expect(result.kind).toBe('translation');
    expect(result.text).toBe('[es] Hello world');
  });

  it('returns the segment unchanged when source equals target', async () => {
    const translator = new MockTranslator();

    const result = await translator.translate(segment, LanguageCode.of('en'), Glossary.empty());

    expect(result).toBe(segment);
  });
});
