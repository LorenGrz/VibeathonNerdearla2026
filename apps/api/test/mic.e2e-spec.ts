import { resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IoAdapter } from '@nestjs/platform-socket.io';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { WS_NAMESPACE_MIC, type SessionDto } from '@subs/domain';
import { AppModule } from '../src/app.module.js';

/**
 * Full composition root in mock mode: a Socket.IO client plays the browser, claims a `mic`
 * session over `/mic` and streams binary PCM; the session must go live and count the chunks.
 */
describe('Mic ingest (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    process.env.TRANSCRIBER = 'mock';
    process.env.TRANSLATOR = 'mock';
    process.env.SAMPLES_DIR = resolve(import.meta.dirname, '../../../samples');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    app.setGlobalPrefix('api');
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await app.close();
  });

  const connect = async (): Promise<Socket> => {
    const socket = io(`${baseUrl}${WS_NAMESPACE_MIC}`, { transports: ['websocket'] });
    sockets.push(socket);
    await new Promise<void>((done) => socket.once('connect', () => done()));
    return socket;
  };

  const nextEvent = <T>(socket: Socket, event: string): Promise<T> =>
    new Promise<T>((done) => socket.once(event, (payload: T) => done(payload)));

  it('streams browser PCM into a running mic session and rejects a second emitter', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/sessions')
      .send({
        title: 'Mic',
        stage: 'Main',
        sourceLanguage: 'es',
        targetLanguages: ['en'],
        source: { kind: 'mic' },
      })
      .expect(201);
    const session = created.body as SessionDto;
    await request(app.getHttpServer()).post(`/api/sessions/${session.id}/start`).expect(201);

    const owner = await connect();
    const started = nextEvent<{ sessionId: string }>(owner, 'mic:started');
    owner.emit('mic:start', { sessionId: session.id });
    await expect(started).resolves.toEqual({ sessionId: session.id });

    const intruder = await connect();
    const rejected = nextEvent<{ message: string }>(intruder, 'mic:error');
    intruder.emit('mic:start', { sessionId: session.id });
    await expect(rejected).resolves.toMatchObject({
      message: expect.stringMatching(/already has an active microphone/) as string,
    });

    // 5 frames of 100 ms (1600 Int16 samples = 3200 bytes each), sent as ArrayBuffers.
    for (let i = 0; i < 5; i += 1) owner.emit('mic:chunk', new Int16Array(1600).buffer);

    await vi.waitFor(
      async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/sessions/${session.id}`)
          .expect(200);
        const dto = res.body as SessionDto;
        expect(dto.status).toBe('live');
        expect(dto.metrics.chunksIn).toBe(5);
        expect(dto.metrics.bytesIn).toBe(5 * 3200);
      },
      { timeout: 5000, interval: 100 },
    );

    const stopped = nextEvent<{ sessionId: string }>(owner, 'mic:stopped');
    owner.emit('mic:stop', { sessionId: session.id });
    await expect(stopped).resolves.toEqual({ sessionId: session.id });

    await request(app.getHttpServer()).post(`/api/sessions/${session.id}/stop`).expect(201);
  }, 15000);
});
