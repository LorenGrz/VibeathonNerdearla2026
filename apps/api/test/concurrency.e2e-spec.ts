import { resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IoAdapter } from '@nestjs/platform-socket.io';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import {
  WS_NAMESPACE_CAPTIONS,
  type CaptionDto,
  type LanguageCodeValue,
  type SessionDto,
} from '@subs/domain';
import { AppModule } from '../src/app.module.js';

/**
 * Full composition root in mock mode: real ffmpeg ingest (samples/tone-2s.mp3), MockTranscriber,
 * MockTranslator, orchestrator and Socket.IO. Proves two sessions run at the same time and each
 * audience room only receives its own captions.
 */
describe('Concurrent sessions (e2e)', () => {
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

  const createSession = async (
    title: string,
    sourceLanguage: LanguageCodeValue,
    target: LanguageCodeValue,
  ): Promise<SessionDto> => {
    const res = await request(app.getHttpServer())
      .post('/api/sessions')
      .send({
        title,
        stage: title,
        sourceLanguage,
        targetLanguages: [target],
        source: { kind: 'file', path: 'tone-2s.mp3' },
      })
      .expect(201);
    return res.body as SessionDto;
  };

  const listen = async (sessionId: string, language: LanguageCodeValue) => {
    const socket = io(`${baseUrl}${WS_NAMESPACE_CAPTIONS}`, { transports: ['websocket'] });
    sockets.push(socket);
    const received: CaptionDto[] = [];
    socket.on('caption', (caption: CaptionDto) => received.push(caption));
    await new Promise<void>((done) => socket.once('connect', () => done()));
    socket.emit('captions:join', { sessionId, language });
    return received;
  };

  it('runs two sessions in parallel with isolated caption rooms', async () => {
    const en = await createSession('Stage A', 'en', 'es');
    const es = await createSession('Stage B', 'es', 'en');

    const enOriginal = await listen(en.id, 'en');
    const enTranslated = await listen(en.id, 'es');
    const esOriginal = await listen(es.id, 'es');

    await Promise.all([
      request(app.getHttpServer()).post(`/api/sessions/${en.id}/start`).expect(201),
      request(app.getHttpServer()).post(`/api/sessions/${es.id}/start`).expect(201),
    ]);

    await vi.waitFor(
      () => {
        expect(enOriginal.some((c) => c.isFinal)).toBe(true);
        expect(enTranslated.some((c) => c.kind === 'translation')).toBe(true);
        expect(esOriginal.some((c) => c.isFinal)).toBe(true);
      },
      { timeout: 8000, interval: 100 },
    );

    expect(enOriginal.every((c) => c.sessionId === en.id && c.language === 'en')).toBe(true);
    expect(enTranslated.every((c) => c.sessionId === en.id && c.language === 'es')).toBe(true);
    expect(esOriginal.every((c) => c.sessionId === es.id && c.language === 'es')).toBe(true);

    const sessions = (await request(app.getHttpServer()).get('/api/sessions').expect(200))
      .body as SessionDto[];
    for (const s of sessions) {
      expect(s.metrics.chunksIn).toBeGreaterThan(0);
    }
  }, 15000);
});
