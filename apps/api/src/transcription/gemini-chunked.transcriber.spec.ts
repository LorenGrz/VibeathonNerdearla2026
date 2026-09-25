import type { GenerateContentParameters } from '@google/genai';
import {
  Glossary,
  GlossaryTerm,
  LanguageCode,
  SessionId,
  sequentialIdGenerator,
  type AudioChunk,
  type TranscriberStream,
  type TranscriptSegment,
} from '@subs/domain';
import type { GeminiContentClient } from './gemini.client.js';
import {
  GeminiChunkedTranscriber,
  buildTranscriptionPrompt,
} from './gemini-chunked.transcriber.js';

class FakeContentClient implements GeminiContentClient {
  readonly calls: GenerateContentParameters[] = [];
  constructor(private readonly replies: (string | Error)[]) {}

  generateContent(params: GenerateContentParameters): Promise<{ text: string | undefined }> {
    this.calls.push(params);
    const reply = this.replies.shift() ?? '';
    return reply instanceof Error ? Promise.reject(reply) : Promise.resolve({ text: reply });
  }
}

const chunk = (offsetMs: number, durationMs = 1000): AudioChunk => ({
  data: new Uint8Array(durationMs * 32),
  offsetMs,
  durationMs,
});

const warnings: string[] = [];
const logger = { warn: (m: string) => void warnings.push(m) };

function open(client: FakeContentClient, signal = new AbortController().signal) {
  return new GeminiChunkedTranscriber(client, {
    model: 'gemini-2.5-flash',
    ids: sequentialIdGenerator('seg'),
    logger,
  }).open({
    sessionId: SessionId.of('s-1'),
    language: LanguageCode.of('en'),
    glossary: new Glossary([new GlossaryTerm('Nerdearla', { es: 'Nerdearla' })]),
    signal,
  });
}

async function drain(stream: TranscriberStream): Promise<TranscriptSegment[]> {
  await stream.close();
  const out: TranscriptSegment[] = [];
  for await (const s of stream.segments()) out.push(s);
  return out;
}

type InlinePart = { text?: string; inlineData?: { mimeType?: string; data?: string } };
const partsOf = (call: GenerateContentParameters | undefined): InlinePart[] => {
  const contents = (call?.contents ?? []) as { parts?: InlinePart[] }[];
  return contents[0]?.parts ?? [];
};

describe('GeminiChunkedTranscriber', () => {
  beforeEach(() => {
    warnings.length = 0;
  });

  it('builds a literal-transcription prompt with glossary terms', () => {
    const prompt = buildTranscriptionPrompt(
      LanguageCode.of('es'),
      new Glossary([new GlossaryTerm('Supabase', {})]),
    );
    expect(prompt).toContain('literally in Spanish');
    expect(prompt).toContain('spell them exactly: Supabase');
  });

  it('sends ~4 s windows as inline WAV and emits finals in order with audio ranges', async () => {
    const client = new FakeContentClient(['  First   window. ', 'Second window.']);
    const stream = await open(client);
    for (let t = 0; t < 8000; t += 1000) stream.push(chunk(t));

    const segments = await drain(stream);
    expect(client.calls).toHaveLength(2);
    const [prompt, audio] = partsOf(client.calls[0]);
    expect(prompt?.text).toContain('literally in English');
    expect(audio?.inlineData?.mimeType).toBe('audio/wav');
    const wav = Buffer.from(audio?.inlineData?.data ?? '', 'base64');
    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.byteLength).toBe(44 + 4000 * 32);
    expect(client.calls[0]?.model).toBe('gemini-2.5-flash');

    expect(segments.map((s) => [s.id, s.text, s.isFinal, s.range.startMs, s.range.endMs])).toEqual([
      ['seg-1', 'First window.', true, 0, 4000],
      ['seg-2', 'Second window.', true, 4000, 8000],
    ]);
  });

  it('flushes the tail on close, drops tails shorter than 300 ms and skips empty replies', async () => {
    const client = new FakeContentClient(['', 'tail']);
    const stream = await open(client);
    for (let t = 0; t < 4000; t += 1000) stream.push(chunk(t));
    stream.push(chunk(4000, 500));

    const segments = await drain(stream);
    expect(segments.map((s) => [s.text, s.range.startMs, s.range.endMs])).toEqual([
      ['tail', 4000, 4500],
    ]);

    const client2 = new FakeContentClient([]);
    const stream2 = await open(client2);
    stream2.push(chunk(0, 200));
    expect(await drain(stream2)).toEqual([]);
    expect(client2.calls).toHaveLength(0);
  });

  it('logs and skips a failed window without ending the stream', async () => {
    const client = new FakeContentClient([new Error('503'), 'recovered']);
    const stream = await open(client);
    for (let t = 0; t < 8000; t += 1000) stream.push(chunk(t));

    expect((await drain(stream)).map((s) => s.text)).toEqual(['recovered']);
    expect(warnings[0]).toMatch(/0-4000 ms: 503/);
  });

  it('close() is idempotent and ignores later pushes', async () => {
    const client = new FakeContentClient([]);
    const stream = await open(client);
    const first = stream.close();
    expect(stream.close()).toBe(first);
    await first;
    for (let t = 0; t < 8000; t += 1000) stream.push(chunk(t));
    expect(client.calls).toHaveLength(0);
  });

  it('abort ends segments() and drops buffered audio', async () => {
    const controller = new AbortController();
    const client = new FakeContentClient(['never']);
    const stream = await open(client, controller.signal);
    stream.push(chunk(0));
    controller.abort();

    expect(await drain(stream)).toEqual([]);
    expect(client.calls).toHaveLength(0);
  });
});
