import { Global, INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IoAdapter } from '@nestjs/platform-socket.io';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import {
  LanguageCode,
  Session,
  SessionId,
  SegmentTranscribed,
  TimeRange,
  Transcript,
  TranscriptSegment,
  WS_NAMESPACE_CAPTIONS,
  type CaptionDto,
  type EventPublisherPort,
  type SessionRepository,
  type SessionRunner,
  type TranscriptRepository,
} from '@subs/domain';
import {
  EVENT_PUBLISHER,
  SESSION_REPOSITORY,
  SESSION_RUNNER,
  TRANSCRIPT_REPOSITORY,
} from '../src/shared/tokens.js';
import { SessionsModule } from '../src/sessions/sessions.module.js';
import { RealtimeModule } from '../src/realtime/realtime.module.js';

class InMemorySessionRepository implements SessionRepository {
  private readonly byId = new Map<string, Session>();

  async save(session: Session): Promise<void> {
    this.byId.set(session.id.value, session);
  }

  async findById(id: SessionId): Promise<Session | null> {
    return this.byId.get(id.value) ?? null;
  }

  async findAll(): Promise<Session[]> {
    return [...this.byId.values()];
  }

  async delete(id: SessionId): Promise<void> {
    this.byId.delete(id.value);
  }
}

class InMemoryTranscriptRepository implements TranscriptRepository {
  private readonly bySession = new Map<string, Transcript>();

  async append(segment: TranscriptSegment): Promise<void> {
    this.getOrCreate(segment.sessionId).add(segment);
  }

  async get(sessionId: SessionId): Promise<Transcript> {
    return this.getOrCreate(sessionId);
  }

  private getOrCreate(sessionId: SessionId): Transcript {
    const existing = this.bySession.get(sessionId.value);
    if (existing) return existing;
    const created = new Transcript(sessionId);
    this.bySession.set(sessionId.value, created);
    return created;
  }
}

const sessionRepo = new InMemorySessionRepository();
const transcriptRepo = new InMemoryTranscriptRepository();

/** Set once the app is up, so the stub runner can publish through the real gateway. */
let publisherRef: EventPublisherPort | undefined;

/** Stub `SessionRunner`: drives idle -> starting -> live synchronously (T3 implements the real one). */
const stubRunner: SessionRunner = {
  async start(id: SessionId): Promise<void> {
    const session = await sessionRepo.findById(id);
    if (!session) throw new Error('stub runner: session not found');
    session.start();
    await sessionRepo.save(session);
    await publisherRef?.publish(session.pullEvents());
    session.markLive();
    await sessionRepo.save(session);
    await publisherRef?.publish(session.pullEvents());
  },
  async stop(id: SessionId): Promise<void> {
    const session = await sessionRepo.findById(id);
    if (!session) return;
    session.stop();
    await sessionRepo.save(session);
    await publisherRef?.publish(session.pullEvents());
  },
};

const emitSegment = async (sessionId: SessionId, lang: string, text: string): Promise<void> => {
  const segment = TranscriptSegment.original({
    sessionId,
    language: LanguageCode.of(lang),
    text,
    range: TimeRange.of(0, 1000),
    isFinal: true,
  });
  await transcriptRepo.append(segment);
  await publisherRef?.publish([new SegmentTranscribed(segment, new Date())]);
};

/**
 * Stands in for the persistence/orchestrator modules T3 will provide in the real app
 * (both expected to be `@Global()`, per the integrator notes in SessionsModule/RealtimeModule).
 */
@Global()
@Module({
  providers: [
    { provide: SESSION_REPOSITORY, useValue: sessionRepo },
    { provide: TRANSCRIPT_REPOSITORY, useValue: transcriptRepo },
    { provide: SESSION_RUNNER, useValue: stubRunner },
  ],
  exports: [SESSION_REPOSITORY, TRANSCRIPT_REPOSITORY, SESSION_RUNNER],
})
class FakesModule {}

const waitForEvent = <T>(socket: Socket, event: string): Promise<T> =>
  new Promise((resolve) => socket.once(event, resolve));

const neverEmits = (socket: Socket, event: string, ms = 250): Promise<boolean> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(true);
    }, ms);
    const handler = (): void => {
      clearTimeout(timer);
      resolve(false);
    };
    socket.once(event, handler);
  });

describe('Sessions (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [FakesModule, SessionsModule, RealtimeModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.init();
    await app.listen(0);

    publisherRef = app.get<EventPublisherPort>(EVENT_PUBLISHER);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unknown session with 404', async () => {
    const res = await request(app.getHttpServer()).get('/api/sessions/unknown-id').expect(404);
    expect(res.body).toMatchObject({ statusCode: 404 });
  });

  it('rejects an invalid language on the transcript endpoint with 400', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/sessions')
      .send({
        title: 'Lang Check',
        stage: 'Main',
        sourceLanguage: 'en',
        targetLanguages: [],
        source: { kind: 'mic' },
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/sessions/${created.body.id}/transcript?lang=xx`)
      .expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, error: 'INVALID_LANGUAGE' });
  });

  it('creates a session, starts it, isolates captions per room and exports SRT', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/sessions')
      .send({
        title: 'Keynote',
        stage: 'Main',
        sourceLanguage: 'en',
        targetLanguages: ['es'],
        source: { kind: 'mic' },
      })
      .expect(201);

    const sessionId: string = createRes.body.id;
    expect(createRes.body.status).toBe('idle');

    const client = io(`${baseUrl}${WS_NAMESPACE_CAPTIONS}`, {
      transports: ['websocket'],
      forceNew: true,
    });
    await waitForEvent(client, 'connect');

    const historyPromise = waitForEvent<CaptionDto[]>(client, 'captions:history');
    client.emit('captions:join', { sessionId, language: 'es' });
    await expect(historyPromise).resolves.toEqual([]);

    const liveStatus = new Promise<{ id: string; status: string }>((resolve) => {
      const handler = (payload: { id: string; status: string }): void => {
        if (payload.status === 'live') {
          client.off('session:status', handler);
          resolve(payload);
        }
      };
      client.on('session:status', handler);
    });

    const startRes = await request(app.getHttpServer())
      .post(`/api/sessions/${sessionId}/start`)
      .expect(201);
    expect(startRes.body.status).toBe('live');
    await expect(liveStatus).resolves.toEqual({ id: sessionId, status: 'live' });

    const captionPromise = waitForEvent<CaptionDto>(client, 'caption');
    await emitSegment(SessionId.of(sessionId), 'es', 'Hola desde Nerdearla');
    const caption = await captionPromise;
    expect(caption).toMatchObject({ language: 'es', text: 'Hola desde Nerdearla' });

    const isolated = neverEmits(client, 'caption');
    await emitSegment(SessionId.of(sessionId), 'en', 'Hello from Nerdearla');
    expect(await isolated).toBe(true);

    client.disconnect();

    const transcriptRes = await request(app.getHttpServer())
      .get(`/api/sessions/${sessionId}/transcript?lang=es`)
      .expect(200);
    expect(transcriptRes.body).toEqual([expect.objectContaining({ text: 'Hola desde Nerdearla' })]);

    const exportRes = await request(app.getHttpServer())
      .get(`/api/sessions/${sessionId}/export?lang=es&format=srt`)
      .expect(200);
    expect(exportRes.headers['content-type']).toContain('application/x-subrip');
    expect(exportRes.headers['content-disposition']).toBe('attachment; filename="Keynote-es.srt"');
    expect(exportRes.text).toContain('Hola desde Nerdearla');

    const conflictRes = await request(app.getHttpServer())
      .post(`/api/sessions/${sessionId}/start`)
      .expect(409);
    expect(conflictRes.body).toMatchObject({
      statusCode: 409,
      error: 'INVALID_SESSION_TRANSITION',
    });

    await request(app.getHttpServer()).delete(`/api/sessions/${sessionId}`).expect(204);
    await request(app.getHttpServer()).get(`/api/sessions/${sessionId}`).expect(404);
  });
});
