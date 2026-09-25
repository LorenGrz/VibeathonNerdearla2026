import {
  Glossary,
  LanguageCode,
  SessionId,
  sequentialIdGenerator,
  type TranscriptSegment,
} from '@subs/domain';
import { MOCK_SCRIPTS, MockTranscriber } from './mock.transcriber.js';

const collect = async (iterable: AsyncIterable<TranscriptSegment>) => {
  const out: TranscriptSegment[] = [];
  for await (const s of iterable) out.push(s);
  return out;
};

describe('MockTranscriber', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const open = (lang: string, signal = new AbortController().signal) =>
    new MockTranscriber({ intervalMs: 300, ids: sequentialIdGenerator('m') }).open({
      sessionId: SessionId.of('s1'),
      language: LanguageCode.of(lang),
      glossary: Glossary.empty(),
      signal,
    });

  it('emits 2 partials + 1 final per phrase of the language script', async () => {
    const stream = await open('es');
    stream.push({ data: new Uint8Array(320), offsetMs: 0, durationMs: 10 });
    await vi.advanceTimersByTimeAsync(600);
    await stream.close();
    const segments = await collect(stream.segments());

    expect(segments).toHaveLength(6);
    expect(segments.map((s) => s.isFinal)).toEqual([false, false, true, false, false, true]);
    expect(segments.map((s) => s.id)).toEqual(['m-1', 'm-1', 'm-1', 'm-2', 'm-2', 'm-2']);
    expect(segments[2]?.text).toBe(MOCK_SCRIPTS.es[0]);
    expect(segments[5]?.text).toBe(MOCK_SCRIPTS.es[1]);
    expect(segments[0]?.text.length).toBeLessThan(segments[1]?.text.length ?? 0);
    expect(segments.every((s) => s.sessionId.value === 's1' && s.language.value === 'es')).toBe(
      true,
    );
    expect(segments.map((s) => [s.range.startMs, s.range.endMs])).toEqual([
      [0, 100],
      [0, 200],
      [0, 300],
      [300, 400],
      [300, 500],
      [300, 600],
    ]);
  });

  it('stops emitting when the signal aborts', async () => {
    const controller = new AbortController();
    const stream = await open('en', controller.signal);
    await vi.advanceTimersByTimeAsync(300);
    controller.abort();
    await vi.advanceTimersByTimeAsync(3000);
    const segments = await collect(stream.segments());
    expect(segments).toHaveLength(3);
  });

  it('ends immediately when opened with an aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const stream = await open('pt', controller.signal);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await collect(stream.segments())).toEqual([]);
  });
});
