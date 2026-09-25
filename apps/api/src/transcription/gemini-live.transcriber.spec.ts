import type { LiveSendRealtimeInputParameters } from '@google/genai';
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
import type {
  GeminiLiveClient,
  GeminiLiveConnectParams,
  GeminiLiveMessage,
  GeminiLiveSession,
} from './gemini.client.js';
import {
  GeminiLiveTranscriber,
  type GeminiLiveTranscriberOptions,
} from './gemini-live.transcriber.js';

class FakeSession implements GeminiLiveSession {
  readonly sent: LiveSendRealtimeInputParameters[] = [];
  closed = false;
  sendRealtimeInput(params: LiveSendRealtimeInputParameters): void {
    this.sent.push(params);
  }
  close(): void {
    this.closed = true;
  }
}

class FakeLiveClient implements GeminiLiveClient {
  readonly connections: { params: GeminiLiveConnectParams; session: FakeSession }[] = [];
  failNext = 0;

  connect(params: GeminiLiveConnectParams): Promise<GeminiLiveSession> {
    if (this.failNext > 0) {
      this.failNext--;
      return Promise.reject(new Error('connect refused'));
    }
    const session = new FakeSession();
    this.connections.push({ params, session });
    return Promise.resolve(session);
  }

  conn(index = this.connections.length - 1) {
    const c = this.connections[index];
    if (!c) throw new Error(`no connection #${index}`);
    return c;
  }

  message(msg: GeminiLiveMessage, index?: number): void {
    this.conn(index).params.callbacks.onmessage(msg);
  }

  dropConnection(index?: number): void {
    this.conn(index).params.callbacks.onclose({ code: 1011, reason: 'gone' });
  }
}

const interim = (text: string): GeminiLiveMessage => ({
  serverContent: { interimInputTranscription: { text } },
});
const final = (text: string, finished?: boolean): GeminiLiveMessage => ({
  serverContent: { inputTranscription: { text, finished } },
});

const chunk = (offsetMs: number, durationMs = 100): AudioChunk => ({
  data: new Uint8Array(durationMs * 32).fill(1),
  offsetMs,
  durationMs,
});

const silentLogger = { warn: () => undefined, log: () => undefined };
const sessionId = SessionId.of('s-1');

async function openStream(
  client: FakeLiveClient,
  overrides: Partial<GeminiLiveTranscriberOptions> = {},
  extra: { glossary?: Glossary; signal?: AbortSignal; language?: string } = {},
): Promise<TranscriberStream> {
  const transcriber = new GeminiLiveTranscriber(client, {
    model: 'gemini-3.5-transcribe-live',
    ids: sequentialIdGenerator('seg'),
    logger: silentLogger,
    ...overrides,
  });
  return transcriber.open({
    sessionId,
    language: LanguageCode.of(extra.language ?? 'es'),
    glossary: extra.glossary ?? Glossary.empty(),
    signal: extra.signal ?? new AbortController().signal,
  });
}

async function drain(stream: TranscriberStream): Promise<TranscriptSegment[]> {
  await stream.close();
  const out: TranscriptSegment[] = [];
  for await (const s of stream.segments()) out.push(s);
  return out;
}

const summary = (segments: TranscriptSegment[]) =>
  segments.map((s) => ({ id: s.id, text: s.text, isFinal: s.isFinal }));

describe('GeminiLiveTranscriber', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects with TEXT modality, language hint and glossary vocabulary', async () => {
    const client = new FakeLiveClient();
    const glossary = new Glossary([
      new GlossaryTerm('Nerdearla', {}),
      new GlossaryTerm('NestJS', {}),
    ]);
    await openStream(client, {}, { glossary });

    const { params } = client.conn();
    expect(params.model).toBe('gemini-3.5-transcribe-live');
    expect(params.config).toEqual({
      responseModalities: ['TEXT'],
      inputAudioTranscription: {
        languageCodes: ['es-419'],
        customVocabulary: ['Nerdearla', 'NestJS'],
      },
    });
  });

  it('sends chunks as base64 PCM realtime input', async () => {
    const client = new FakeLiveClient();
    const stream = await openStream(client);
    const c = chunk(0, 10);
    stream.push(c);

    expect(client.conn().session.sent).toEqual([
      { audio: { data: Buffer.from(c.data).toString('base64'), mimeType: 'audio/pcm;rate=16000' } },
    ]);
  });

  it('emits interim hypotheses as partials and inputTranscription as the final, same id', async () => {
    const client = new FakeLiveClient();
    const stream = await openStream(client);
    for (let t = 0; t < 2000; t += 100) stream.push(chunk(t));
    client.message(interim('hola'));
    client.message(interim('hola'));
    client.message(interim('hola mundo'));
    client.message(final('Hola mundo.'));
    stream.push(chunk(2000));
    client.message(interim('chau'));
    client.message(final('Chau.'));

    const segments = await drain(stream);
    expect(summary(segments)).toEqual([
      { id: 'seg-1', text: 'hola', isFinal: false },
      { id: 'seg-1', text: 'hola mundo', isFinal: false },
      { id: 'seg-1', text: 'Hola mundo.', isFinal: true },
      { id: 'seg-2', text: 'chau', isFinal: false },
      { id: 'seg-2', text: 'Chau.', isFinal: true },
    ]);
    // start = audio at first text (2000) - 1000 ms lookback; end = audio pushed so far
    expect([segments[2]?.range.startMs, segments[2]?.range.endMs]).toEqual([1000, 2000]);
    // next utterance never starts before the previous final ended
    expect([segments[4]?.range.startMs, segments[4]?.range.endMs]).toEqual([2000, 2100]);
    expect(segments.every((s) => s.sessionId.equals(sessionId) && s.language.value === 'es')).toBe(
      true,
    );
  });

  it('accumulates transcription deltas and finalizes after 700 ms without new text', async () => {
    const client = new FakeLiveClient();
    const stream = await openStream(client, {}, { language: 'en' });
    stream.push(chunk(0));
    client.message(final('Hello'));
    client.message(final(' world'));
    await vi.advanceTimersByTimeAsync(699);
    client.message(final(' again'));
    await vi.advanceTimersByTimeAsync(700);

    expect(summary(await drain(stream))).toEqual([
      { id: 'seg-1', text: 'Hello', isFinal: false },
      { id: 'seg-1', text: 'Hello world', isFinal: false },
      { id: 'seg-1', text: 'Hello world again', isFinal: false },
      { id: 'seg-1', text: 'Hello world again', isFinal: true },
    ]);
  });

  it('finalizes deltas on finished and on turnComplete', async () => {
    const client = new FakeLiveClient();
    const stream = await openStream(client);
    client.message(final('uno', true));
    client.message(final('dos'));
    client.message({ serverContent: { turnComplete: true } });

    expect(summary(await drain(stream)).filter((s) => s.isFinal)).toEqual([
      { id: 'seg-1', text: 'uno', isFinal: true },
      { id: 'seg-2', text: 'dos', isFinal: true },
    ]);
  });

  it('forces a final after ~12 s and does not repeat those words when the server finalizes', async () => {
    const client = new FakeLiveClient();
    const stream = await openStream(client, { firstTextLookbackMs: 0 });
    stream.push(chunk(0, 1000));
    client.message(interim('uno dos tres'));
    stream.push(chunk(1000, 12_000)); // utterance now spans 12 s -> forced final
    client.message(interim('uno dos tres cuatro'));
    client.message(final('Uno, dos, tres, cuatro cinco.'));

    expect(summary(await drain(stream))).toEqual([
      { id: 'seg-1', text: 'uno dos tres', isFinal: false },
      { id: 'seg-1', text: 'uno dos tres', isFinal: true },
      { id: 'seg-2', text: 'cuatro', isFinal: false },
      { id: 'seg-2', text: 'cuatro cinco.', isFinal: true },
    ]);
  });

  it('reconnects on goAway without ending segments(), buffering audio meanwhile', async () => {
    const client = new FakeLiveClient();
    const stream = await openStream(client);
    client.message(interim('antes del corte'));
    client.message({ goAway: { timeLeft: '5s' } });
    stream.push(chunk(0)); // pushed while reconnecting

    await vi.advanceTimersByTimeAsync(0);
    expect(client.connections).toHaveLength(2);
    expect(client.conn(0).session.closed).toBe(true);
    expect(client.conn(1).session.sent).toHaveLength(1); // buffered chunk replayed

    client.message(interim('ignorado'), 0); // late message from the old connection
    client.message(final('después'), 1); // interim mode persists: a final right away

    expect(summary(await drain(stream))).toEqual([
      { id: 'seg-1', text: 'antes del corte', isFinal: false },
      { id: 'seg-1', text: 'antes del corte', isFinal: true },
      { id: 'seg-2', text: 'después', isFinal: true },
    ]);
  });

  it('reconnects after an unexpected close, retrying with backoff', async () => {
    const client = new FakeLiveClient();
    const stream = await openStream(client);
    client.failNext = 2;
    client.dropConnection();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(client.connections).toHaveLength(2);
    client.message(final('ok', true));
    expect(summary(await drain(stream))).toEqual([
      { id: 'seg-1', text: 'ok', isFinal: false },
      { id: 'seg-1', text: 'ok', isFinal: true },
    ]);
  });

  it('fails segments() when the connection keeps dropping before any message', async () => {
    const client = new FakeLiveClient();
    const stream = await openStream(client, { maxReconnectAttempts: 2 });
    const consumed = (async () => {
      for await (const _ of stream.segments()) {
        // drain
      }
    })();
    const rejection = expect(consumed).rejects.toThrow(/reconnect attempts exhausted/);

    client.dropConnection(0);
    await vi.advanceTimersByTimeAsync(0);
    client.dropConnection(1);
    await vi.advanceTimersByTimeAsync(5_000);
    client.dropConnection(2);
    await vi.advanceTimersByTimeAsync(5_000);

    await rejection;
    expect(client.connections).toHaveLength(3);
  });

  it('resumes with the last handle when session resumption is enabled', async () => {
    const client = new FakeLiveClient();
    await openStream(client, { useSessionResumption: true });
    expect(client.conn().params.config.sessionResumption).toEqual({});

    client.message({ sessionResumptionUpdate: { resumable: true, newHandle: 'h-1' } });
    client.message({ goAway: {} });
    await vi.advanceTimersByTimeAsync(0);

    expect(client.conn(1).params.config.sessionResumption).toEqual({ handle: 'h-1' });
  });

  it('close() is idempotent, flushes pending text and closes the connection', async () => {
    const client = new FakeLiveClient();
    const stream = await openStream(client);
    client.message(interim('a medias'));
    const first = stream.close();
    expect(stream.close()).toBe(first);
    await first;
    stream.push(chunk(0));

    expect(client.conn().session.closed).toBe(true);
    expect(client.conn().session.sent).toHaveLength(0);
    expect(summary(await drain(stream)).at(-1)).toEqual({
      id: 'seg-1',
      text: 'a medias',
      isFinal: true,
    });
  });

  it('closes when the signal aborts', async () => {
    const client = new FakeLiveClient();
    const controller = new AbortController();
    const stream = await openStream(client, {}, { signal: controller.signal });
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(client.conn().session.closed).toBe(true);
    expect(await drain(stream)).toEqual([]);
  });

  it('rejects open() when the first connection fails', async () => {
    const client = new FakeLiveClient();
    client.failNext = 1;
    await expect(openStream(client)).rejects.toThrow('connect refused');
  });
});
