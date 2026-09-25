import { ConflictException, Logger, Module, NotFoundException } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  LanguageCode,
  Session,
  SessionId,
  sequentialIdGenerator,
  type AudioChunk,
  type AudioSourcePort,
  type AudioSourceSpec,
  type DomainEvent,
  type EventPublisherPort,
  type Glossary,
  type SessionRepository,
  type SessionRunner,
  type TranscriberPort,
  type TranscriptRepository,
  type TranscriptSegment,
  type TranslatorPort,
} from '@subs/domain';
import type { Env } from '../config/env.js';
import { InMemorySessionRepository } from '../persistence/in-memory-session.repository.js';
import { InMemoryTranscriptRepository } from '../persistence/in-memory-transcript.repository.js';
import {
  AUDIO_SOURCE,
  EVENT_PUBLISHER,
  SESSION_REPOSITORY,
  SESSION_RUNNER,
  TRANSCRIBER,
  TRANSCRIPT_REPOSITORY,
  TRANSLATOR,
} from '../shared/tokens.js';
import { MockTranscriber } from '../transcription/mock.transcriber.js';
import { OrchestratorModule } from './orchestrator.module.js';
import { backoffDelay, type OrchestratorOptions } from './orchestrator.options.js';
import { SessionOrchestrator } from './session-orchestrator.js';

const en = LanguageCode.of('en');
const es = LanguageCode.of('es');
const pt = LanguageCode.of('pt');

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ---------- local fakes ----------

/** Emits a 10 ms PCM chunk every 2 ms until aborted (or until `limit` chunks). */
class FakeAudioSource implements AudioSourcePort {
  opens = 0;
  constructor(
    private readonly failFirstOpens = 0,
    private readonly limit = Number.POSITIVE_INFINITY,
  ) {}

  async *open(_spec: AudioSourceSpec, signal: AbortSignal): AsyncGenerator<AudioChunk> {
    this.opens += 1;
    if (this.opens <= this.failFirstOpens) throw new Error('source down');
    for (let i = 0; i < this.limit && !signal.aborted; i++) {
      await wait(2);
      if (signal.aborted) return;
      yield { data: new Uint8Array(320), offsetMs: i * 10, durationMs: 10 };
    }
  }
}

/** Fails the first `failures` opens, then delegates. */
class FlakyTranscriber implements TranscriberPort {
  opens = 0;
  constructor(
    private readonly inner: TranscriberPort,
    private readonly failures: number,
  ) {}

  open(p: Parameters<TranscriberPort['open']>[0]) {
    this.opens += 1;
    if (this.opens <= this.failures) return Promise.reject(new Error('transcriber unavailable'));
    return this.inner.open(p);
  }
}

class FakeTranslator implements TranslatorPort {
  constructor(private readonly failFor: string[] = []) {}

  translate(segment: TranscriptSegment, target: LanguageCode, _glossary: Glossary) {
    if (this.failFor.includes(target.value)) {
      return Promise.reject(new Error(`no ${target.value}`));
    }
    return Promise.resolve(segment.translate(target, `[${target.value}] ${segment.text}`));
  }
}

class RecordingPublisher implements EventPublisherPort {
  readonly events: DomainEvent[] = [];
  publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events);
    return Promise.resolve();
  }
  forSession(id: SessionId): DomainEvent[] {
    return this.events.filter((e) => e.sessionId === id.value);
  }
  types(id: SessionId): string[] {
    return this.forSession(id)
      .map((e) => e.type)
      .filter((t) => t.startsWith('session.'));
  }
}

const segmentOf = (e: DomainEvent): TranscriptSegment | undefined =>
  (e as { segment?: TranscriptSegment }).segment;

// ---------- harness ----------

interface HarnessOptions {
  maxSessions?: number;
  audio?: AudioSourcePort;
  transcriber?: TranscriberPort;
  translator?: TranslatorPort;
  options?: Partial<OrchestratorOptions>;
}

const FAST: Partial<OrchestratorOptions> = {
  baseDelayMs: 1,
  maxDelayMs: 4,
  maxRetries: 5,
  stopTimeoutMs: 1000,
};

const harness = (o: HarnessOptions = {}) => {
  const sessions = new InMemorySessionRepository();
  const transcripts = new InMemoryTranscriptRepository();
  const publisher = new RecordingPublisher();
  const audio = o.audio ?? new FakeAudioSource();
  const orchestrator = new SessionOrchestrator(
    sessions,
    transcripts,
    audio,
    o.transcriber ?? new MockTranscriber({ intervalMs: 30, ids: sequentialIdGenerator('seg') }),
    o.translator ?? new FakeTranslator(),
    publisher,
    new ConfigService<Env, true>({ MAX_SESSIONS: o.maxSessions ?? 4 }),
    { ...FAST, ...o.options },
  );
  const create = async (
    title: string,
    sourceLanguage: LanguageCode,
    targetLanguages: LanguageCode[],
  ) => {
    const session = Session.create({
      title,
      stage: title,
      sourceLanguage,
      targetLanguages,
      source: { kind: 'file', path: `${title}.wav` },
    });
    await sessions.save(session);
    return session;
  };
  const finals = async (id: SessionId) => (await transcripts.get(id)).all();
  return { sessions, transcripts, publisher, audio, orchestrator, create, finals };
};

let current: ReturnType<typeof harness> | undefined;
const setup = (o?: HarnessOptions) => {
  current = harness(o);
  return current;
};

beforeAll(() => {
  Logger.overrideLogger(false);
});

afterEach(async () => {
  await current?.orchestrator.onModuleDestroy();
  current = undefined;
});

// ---------- specs ----------

describe('backoffDelay', () => {
  it('doubles from 1 s and caps at 30 s', () => {
    const o = { baseDelayMs: 1000, maxDelayMs: 30_000 };
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => backoffDelay(n, o))).toEqual([
      1000, 2000, 4000, 8000, 16_000, 30_000, 30_000,
    ]);
  });
});

describe('SessionOrchestrator', () => {
  it('runs 2 concurrent Mock sessions with isolated segments', async () => {
    const h = setup();
    const a = await h.create('a', en, [es, pt]);
    const b = await h.create('b', es, [en]);

    await Promise.all([h.orchestrator.start(a.id), h.orchestrator.start(b.id)]);
    expect(h.orchestrator.runningCount()).toBe(2);

    await vi.waitFor(
      async () => {
        expect(a.status).toBe('live');
        expect(b.status).toBe('live');
        expect((await h.finals(a.id)).length).toBeGreaterThanOrEqual(6); // 2 originals x (1 + 2)
        expect((await h.finals(b.id)).length).toBeGreaterThanOrEqual(4); // 2 originals x (1 + 1)
      },
      { timeout: 2000, interval: 10 },
    );

    const finalsA = await h.finals(a.id);
    const finalsB = await h.finals(b.id);
    expect(finalsA.every((s) => s.sessionId.equals(a.id))).toBe(true);
    expect(finalsB.every((s) => s.sessionId.equals(b.id))).toBe(true);
    expect(new Set(finalsA.map((s) => s.language.value))).toEqual(new Set(['en', 'es', 'pt']));
    expect(new Set(finalsB.map((s) => s.language.value))).toEqual(new Set(['es', 'en']));
    // No id is shared between the sessions.
    const idsA = new Set(finalsA.map((s) => s.id));
    expect(finalsB.some((s) => idsA.has(s.id))).toBe(false);

    // Every published segment event carries the segment of its own session.
    const segmentEvents = h.publisher.events.filter((e) => e.type.startsWith('segment.'));
    expect(segmentEvents.length).toBeGreaterThan(0);
    for (const e of segmentEvents) expect(segmentOf(e)?.sessionId.value).toBe(e.sessionId);
    // Partials are published (not persisted) and finals trigger translations.
    const aTranscribed = h.publisher
      .forSession(a.id)
      .filter((e) => e.type === 'segment.transcribed');
    expect(aTranscribed.some((e) => segmentOf(e)?.isFinal === false)).toBe(true);
    expect(h.publisher.forSession(a.id).some((e) => e.type === 'segment.translated')).toBe(true);
    const translation = finalsA.find((s) => s.kind === 'translation' && s.language.equals(es));
    expect(translation?.text).toMatch(/^\[es\] /);
    expect(finalsA.some((s) => s.id === translation?.sourceSegmentId)).toBe(true);

    expect(h.publisher.types(a.id).slice(0, 2)).toEqual(['session.started', 'session.live']);
    const metrics = a.toSnapshot().metrics;
    expect(metrics.chunksIn).toBeGreaterThan(0);
    expect(metrics.bytesIn).toBe(metrics.chunksIn * 320);
  });

  it('stopping one session does not affect the other', async () => {
    const h = setup();
    const a = await h.create('a', en, [es]);
    const b = await h.create('b', es, [en]);
    await h.orchestrator.start(a.id);
    await h.orchestrator.start(b.id);
    await vi.waitFor(() => expect([a.status, b.status]).toEqual(['live', 'live']), {
      timeout: 1000,
      interval: 5,
    });

    await h.orchestrator.stop(a.id);
    expect(a.status).toBe('stopped');
    expect(h.orchestrator.isRunning(a.id)).toBe(false);
    expect(h.orchestrator.isRunning(b.id)).toBe(true);
    expect(h.publisher.types(a.id).at(-1)).toBe('session.stopped');

    const aCount = (await h.finals(a.id)).length;
    const aEvents = h.publisher.forSession(a.id).length;
    const bCount = (await h.finals(b.id)).length;
    await vi.waitFor(
      async () => expect((await h.finals(b.id)).length).toBeGreaterThan(bCount + 2),
      { timeout: 2000, interval: 10 },
    );
    expect(b.status).toBe('live');
    expect((await h.finals(a.id)).length).toBe(aCount);
    expect(h.publisher.forSession(a.id)).toHaveLength(aEvents);
  });

  it('fails with ConflictException when MAX_SESSIONS is exceeded', async () => {
    const h = setup({ maxSessions: 2 });
    const [a, b, c] = await Promise.all([
      h.create('a', en, []),
      h.create('b', en, []),
      h.create('c', en, []),
    ]);
    await h.orchestrator.start(a.id);
    await h.orchestrator.start(b.id);

    await expect(h.orchestrator.start(c.id)).rejects.toBeInstanceOf(ConflictException);
    expect(c.status).toBe('idle');
    expect(h.orchestrator.isRunning(c.id)).toBe(false);

    await h.orchestrator.stop(a.id);
    await h.orchestrator.start(c.id);
    expect(h.orchestrator.isRunning(c.id)).toBe(true);
  });

  it('rejects concurrent starts beyond MAX_SESSIONS atomically', async () => {
    const h = setup({ maxSessions: 1 });
    const a = await h.create('a', en, []);
    const b = await h.create('b', en, []);
    const results = await Promise.allSettled([
      h.orchestrator.start(a.id),
      h.orchestrator.start(b.id),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(h.orchestrator.runningCount()).toBe(1);
  });

  it('rejects starting a running session and unknown ids', async () => {
    const h = setup();
    const a = await h.create('a', en, []);
    await h.orchestrator.start(a.id);
    await expect(h.orchestrator.start(a.id)).rejects.toBeInstanceOf(ConflictException);
    await expect(h.orchestrator.start(SessionId.of('nope'))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(h.orchestrator.stop(SessionId.of('nope'))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('retries a transient source failure and goes live', async () => {
    const audio = new FakeAudioSource(2);
    const h = setup({ audio });
    const a = await h.create('a', en, [es]);
    await h.orchestrator.start(a.id);

    await vi.waitFor(() => expect(a.status).toBe('live'), { timeout: 1000, interval: 5 });
    expect(audio.opens).toBe(3);
    expect(a.toSnapshot().metrics).toMatchObject({ errors: 2, lastError: 'source down' });
    expect(h.publisher.types(a.id)).toEqual(['session.started', 'session.live']);
    expect(h.orchestrator.isRunning(a.id)).toBe(true);
  });

  it('retries a transient transcriber failure and goes live', async () => {
    const transcriber = new FlakyTranscriber(new MockTranscriber({ intervalMs: 30 }), 1);
    const h = setup({ transcriber });
    const a = await h.create('a', en, []);
    await h.orchestrator.start(a.id);

    await vi.waitFor(() => expect(a.status).toBe('live'), { timeout: 1000, interval: 5 });
    expect(transcriber.opens).toBe(2);
    expect(a.toSnapshot().metrics.lastError).toBe('transcriber unavailable');
  });

  it('fails the session when retries are exhausted', async () => {
    const audio = new FakeAudioSource(Number.POSITIVE_INFINITY);
    const h = setup({ audio, options: { maxRetries: 2 } });
    const a = await h.create('a', en, []);
    const b = await h.create('b', es, []);
    await h.orchestrator.start(a.id);

    await vi.waitFor(() => expect(a.status).toBe('error'), { timeout: 1000, interval: 5 });
    expect(audio.opens).toBe(3); // 1 attempt + 2 retries
    expect(a.failureReason).toMatch(/source down/);
    expect(h.publisher.types(a.id)).toEqual(['session.started', 'session.failed']);
    await vi.waitFor(() => expect(h.orchestrator.isRunning(a.id)).toBe(false));
    // The slot is released and the failed session can be restarted.
    expect(h.orchestrator.runningCount()).toBe(0);
    await h.orchestrator.start(b.id);
    await h.orchestrator.start(a.id);
    expect(a.status).toBe('starting');
  });

  it('keeps the session live when a translation fails', async () => {
    const h = setup({ translator: new FakeTranslator(['pt']) });
    const a = await h.create('a', en, [es, pt]);
    await h.orchestrator.start(a.id);

    await vi.waitFor(
      async () => {
        const finals = await h.finals(a.id);
        expect(finals.filter((s) => s.language.equals(es)).length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 2000, interval: 10 },
    );
    expect(a.status).toBe('live');
    expect((await h.finals(a.id)).some((s) => s.language.equals(pt))).toBe(false);
    expect(a.toSnapshot().metrics.lastError).toMatch(/translation to pt failed: no pt/);
  });

  it('stops the session when the audio source ends on its own', async () => {
    const h = setup({ audio: new FakeAudioSource(0, 5) });
    const a = await h.create('a', en, []);
    await h.orchestrator.start(a.id);

    await vi.waitFor(() => expect(a.status).toBe('stopped'), { timeout: 1000, interval: 5 });
    await vi.waitFor(() => expect(h.orchestrator.isRunning(a.id)).toBe(false));
    expect(h.publisher.types(a.id)).toEqual(['session.started', 'session.live', 'session.stopped']);
  });

  it('onModuleDestroy stops every running session', async () => {
    const h = setup();
    const a = await h.create('a', en, []);
    const b = await h.create('b', en, []);
    await h.orchestrator.start(a.id);
    await h.orchestrator.start(b.id);
    await h.orchestrator.onModuleDestroy();
    expect([a.status, b.status]).toEqual(['stopped', 'stopped']);
    expect(h.orchestrator.runningCount()).toBe(0);
  });
});

describe('OrchestratorModule wiring', () => {
  it('resolves SESSION_RUNNER with the integrator-provided adapters', async () => {
    const publisher = new RecordingPublisher();

    @Module({
      providers: [
        { provide: AUDIO_SOURCE, useValue: new FakeAudioSource() },
        { provide: TRANSCRIBER, useFactory: () => new MockTranscriber({ intervalMs: 30 }) },
        { provide: TRANSLATOR, useValue: new FakeTranslator() },
        { provide: EVENT_PUBLISHER, useValue: publisher },
      ],
      exports: [AUDIO_SOURCE, TRANSCRIBER, TRANSLATOR, EVENT_PUBLISHER],
    })
    class FakeAdaptersModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ MAX_SESSIONS: 3 })],
        }),
        OrchestratorModule.register({ imports: [FakeAdaptersModule], options: FAST }),
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const runner = app.get<SessionRunner>(SESSION_RUNNER);
    expect(runner).toBeInstanceOf(SessionOrchestrator);
    expect(app.get(SessionOrchestrator)).toBe(runner);
    const repo = app.get<SessionRepository>(SESSION_REPOSITORY);
    const transcripts = app.get<TranscriptRepository>(TRANSCRIPT_REPOSITORY);

    const session = Session.create({
      title: 'wired',
      stage: 'Main',
      sourceLanguage: en,
      targetLanguages: [es],
      source: { kind: 'mic' },
    });
    await repo.save(session);
    await runner.start(session.id);
    await vi.waitFor(
      async () => expect((await transcripts.get(session.id)).forLanguage(es).length).toBe(1),
      { timeout: 1000, interval: 5 },
    );

    await app.close(); // onModuleDestroy stops the session
    expect(session.status).toBe('stopped');
    expect(publisher.types(session.id).at(-1)).toBe('session.stopped');
  });
});
