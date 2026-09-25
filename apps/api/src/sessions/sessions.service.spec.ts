import { NotFoundException } from '@nestjs/common';
import {
  Session,
  SessionId,
  Transcript,
  TranscriptSegment,
  LanguageCode,
  TimeRange,
  type SessionRepository,
  type SessionRunner,
  type TranscriptRepository,
} from '@subs/domain';
import type { TranscriptExporterMap } from './exporters/index.js';
import { SessionsService } from './sessions.service.js';

class FakeSessionRepository implements SessionRepository {
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

class FakeTranscriptRepository implements TranscriptRepository {
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

const buildService = () => {
  const sessions = new FakeSessionRepository();
  const transcripts = new FakeTranscriptRepository();
  const runner = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  } satisfies SessionRunner;
  const exporters: TranscriptExporterMap = {
    srt: { format: 'srt', mimeType: 'application/x-subrip', export: () => 'SRT' },
    vtt: { format: 'vtt', mimeType: 'text/vtt', export: () => 'VTT' },
    txt: { format: 'txt', mimeType: 'text/plain', export: () => 'TXT' },
  };
  const service = new SessionsService(sessions, transcripts, runner, exporters);
  return { service, sessions, transcripts, runner };
};

const createSessionInput = {
  title: 'Keynote',
  stage: 'Main',
  sourceLanguage: 'en',
  targetLanguages: ['es'],
  source: { kind: 'mic' as const },
};

describe('SessionsService', () => {
  it('creates and persists a session', async () => {
    const { service, sessions } = buildService();
    const dto = await service.create(createSessionInput);
    expect(dto.title).toBe('Keynote');
    expect(dto.status).toBe('idle');
    await expect(sessions.findById(SessionId.of(dto.id))).resolves.not.toBeNull();
  });

  it('throws NotFoundException for an unknown session', async () => {
    const { service } = buildService();
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delegates start to the session runner and returns the fresh snapshot', async () => {
    const { service, runner } = buildService();
    const dto = await service.create(createSessionInput);
    await service.start(dto.id);
    expect(runner.start).toHaveBeenCalledWith(expect.objectContaining({ value: dto.id }));
  });

  it('returns only final segments for the requested language', async () => {
    const { service, transcripts } = buildService();
    const dto = await service.create(createSessionInput);
    const sessionId = SessionId.of(dto.id);
    await transcripts.append(
      TranscriptSegment.original({
        sessionId,
        language: LanguageCode.of('es'),
        text: 'Hola',
        range: TimeRange.of(0, 1000),
        isFinal: true,
      }),
    );
    await transcripts.append(
      TranscriptSegment.original({
        sessionId,
        language: LanguageCode.of('en'),
        text: 'Hello',
        range: TimeRange.of(0, 1000),
        isFinal: true,
      }),
    );

    const captions = await service.transcript(dto.id, 'es');
    expect(captions).toHaveLength(1);
    expect(captions[0]?.text).toBe('Hola');
  });

  it('exports a transcript using the matching exporter', async () => {
    const { service } = buildService();
    const dto = await service.create(createSessionInput);
    const result = await service.export(dto.id, 'en', 'srt');
    expect(result.content).toBe('SRT');
    expect(result.mimeType).toBe('application/x-subrip');
    expect(result.filename).toBe('Keynote-en.srt');
  });

  it('rejects an unsupported export format', async () => {
    const { service } = buildService();
    const dto = await service.create(createSessionInput);
    await expect(service.export(dto.id, 'en', 'pdf')).rejects.toThrow(/Unsupported export format/);
  });
});
