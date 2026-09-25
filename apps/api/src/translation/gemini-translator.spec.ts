import {
  Glossary,
  GlossaryTerm,
  LanguageCode,
  SessionId,
  TimeRange,
  TranscriptSegment,
  sequentialIdGenerator,
} from '@subs/domain';
import type { GeminiTextClient, GeminiTranslationRequest } from './gemini-client.js';
import { GeminiTranslator } from './gemini-translator.js';

function originalSegment(overrides: Partial<{ sessionId: SessionId; text: string }> = {}) {
  return TranscriptSegment.original(
    {
      sessionId: overrides.sessionId ?? SessionId.of('session-1'),
      language: LanguageCode.of('en'),
      text: overrides.text ?? 'Hello world',
      range: TimeRange.of(0, 1000),
      isFinal: true,
    },
    sequentialIdGenerator('seg'),
  );
}

class FakeGeminiTextClient implements GeminiTextClient {
  calls: GeminiTranslationRequest[] = [];
  private readonly responses: Array<() => Promise<string>>;

  constructor(responses: Array<() => Promise<string>>) {
    this.responses = responses;
  }

  async generateText(request: GeminiTranslationRequest): Promise<string> {
    this.calls.push(request);
    const next = this.responses[this.calls.length - 1];
    if (!next) throw new Error('FakeGeminiTextClient: no more scripted responses');
    return await next();
  }
}

describe('GeminiTranslator', () => {
  it('returns the segment unchanged and skips the client when source equals target', async () => {
    const client = new FakeGeminiTextClient([]);
    const translator = new GeminiTranslator(client, 'gemini-2.5-flash');
    const segment = originalSegment();

    const result = await translator.translate(segment, LanguageCode.of('en'), Glossary.empty());

    expect(result).toBe(segment);
    expect(client.calls).toHaveLength(0);
  });

  it('includes the glossary section for the target language in the prompt', async () => {
    const client = new FakeGeminiTextClient([() => Promise.resolve('Hola mundo')]);
    const translator = new GeminiTranslator(client, 'gemini-2.5-flash');
    const glossary = new Glossary([new GlossaryTerm('Kubernetes', {})]);

    await translator.translate(originalSegment(), LanguageCode.of('es'), glossary);

    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.prompt).toContain(glossary.toPromptSection(LanguageCode.of('es')));
  });

  it('returns a translation segment with the translated text', async () => {
    const client = new FakeGeminiTextClient([() => Promise.resolve('  Hola mundo  ')]);
    const translator = new GeminiTranslator(client, 'gemini-2.5-flash');
    const segment = originalSegment();

    const result = await translator.translate(segment, LanguageCode.of('es'), Glossary.empty());

    expect(result.kind).toBe('translation');
    expect(result.sourceSegmentId).toBe(segment.id);
    expect(result.language.value).toBe('es');
    expect(result.text).toBe('Hola mundo');
    expect(result.range.equals(segment.range)).toBe(true);
  });

  it('carries the last two original sentences of the session as context, not translating them', async () => {
    const client = new FakeGeminiTextClient([
      () => Promise.resolve('one'),
      () => Promise.resolve('two'),
      () => Promise.resolve('three'),
    ]);
    const translator = new GeminiTranslator(client, 'gemini-2.5-flash');
    const sessionId = SessionId.of('session-1');

    await translator.translate(
      originalSegment({ sessionId, text: 'First sentence.' }),
      LanguageCode.of('es'),
      Glossary.empty(),
    );
    await translator.translate(
      originalSegment({ sessionId, text: 'Second sentence.' }),
      LanguageCode.of('es'),
      Glossary.empty(),
    );
    await translator.translate(
      originalSegment({ sessionId, text: 'Third sentence.' }),
      LanguageCode.of('es'),
      Glossary.empty(),
    );

    expect(client.calls[0]?.prompt).not.toContain('Context');
    expect(client.calls[1]?.prompt).toContain('- First sentence.');
    expect(client.calls[2]?.prompt).toContain('- First sentence.');
    expect(client.calls[2]?.prompt).toContain('- Second sentence.');
    expect(client.calls[2]?.prompt).not.toContain('- Third sentence.');
  });

  it('keeps context isolated per session', async () => {
    const client = new FakeGeminiTextClient([
      () => Promise.resolve('a'),
      () => Promise.resolve('b'),
    ]);
    const translator = new GeminiTranslator(client, 'gemini-2.5-flash');

    await translator.translate(
      originalSegment({ sessionId: SessionId.of('session-1'), text: 'From session one.' }),
      LanguageCode.of('es'),
      Glossary.empty(),
    );
    await translator.translate(
      originalSegment({ sessionId: SessionId.of('session-2'), text: 'From session two.' }),
      LanguageCode.of('es'),
      Glossary.empty(),
    );

    expect(client.calls[1]?.prompt).not.toContain('From session one.');
  });

  it('retries twice after failures and throws once all three attempts fail', async () => {
    const client = new FakeGeminiTextClient([
      () => Promise.reject(new Error('timeout')),
      () => Promise.reject(new Error('503 high demand')),
      () => Promise.reject(new Error('504 deadline expired')),
    ]);
    const translator = new GeminiTranslator(client, 'gemini-2.5-flash');

    await expect(
      translator.translate(originalSegment(), LanguageCode.of('es'), Glossary.empty()),
    ).rejects.toThrow(/Gemini translation failed after 3 attempts: 504 deadline expired/);
    expect(client.calls).toHaveLength(3);
  });

  it('succeeds on the retry after a single failure', async () => {
    const client = new FakeGeminiTextClient([
      () => Promise.reject(new Error('timeout')),
      () => Promise.resolve('Hola mundo'),
    ]);
    const translator = new GeminiTranslator(client, 'gemini-2.5-flash');

    const result = await translator.translate(
      originalSegment(),
      LanguageCode.of('es'),
      Glossary.empty(),
    );

    expect(result.text).toBe('Hola mundo');
    expect(client.calls).toHaveLength(2);
  });
});
