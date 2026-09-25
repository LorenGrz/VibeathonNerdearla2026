import {
  LanguageCode,
  Session,
  SessionId,
  TimeRange,
  Transcript,
  TranscriptSegment,
  fixedClock,
  sequentialIdGenerator,
  type SessionRepository,
  type TranscriptRepository,
} from '@subs/domain';
import type { Socket } from 'socket.io';
import { CaptionsGateway } from './captions.gateway.js';

const buildSession = (): Session =>
  Session.create(
    {
      title: 'Keynote',
      stage: 'Main',
      sourceLanguage: LanguageCode.of('en'),
      targetLanguages: [LanguageCode.of('es')],
      source: { kind: 'mic' },
    },
    { clock: fixedClock('2026-01-01T00:00:00Z'), ids: sequentialIdGenerator('session') },
  );

const buildClient = () => {
  const emit = vi.fn();
  const join = vi.fn();
  const leave = vi.fn();
  const client = { emit, join, leave } as unknown as Socket;
  return { client, emit, join, leave };
};

describe('CaptionsGateway', () => {
  it('joins the room and sends caption history on captions:join', async () => {
    const session = buildSession();
    const transcript = new Transcript(session.id);
    transcript.add(
      TranscriptSegment.original(
        {
          sessionId: session.id,
          language: LanguageCode.of('es'),
          text: 'Hola',
          range: TimeRange.of(0, 1000),
          isFinal: true,
        },
        sequentialIdGenerator('seg'),
      ),
    );
    const sessions: SessionRepository = {
      save: vi.fn(),
      findById: vi.fn().mockResolvedValue(session),
      findAll: vi.fn(),
      delete: vi.fn(),
    };
    const transcripts: TranscriptRepository = {
      append: vi.fn(),
      get: vi.fn().mockResolvedValue(transcript),
    };
    const gateway = new CaptionsGateway(sessions, transcripts);
    const { client, join, emit } = buildClient();

    await gateway.handleJoin(client, { sessionId: session.id.value, language: 'es' });

    expect(join).toHaveBeenCalledWith(`session:${session.id.value}:es`);
    expect(emit).toHaveBeenCalledWith('captions:history', [
      expect.objectContaining({ text: 'Hola' }),
    ]);
  });

  it('emits captions:error when the session does not exist', async () => {
    const sessions: SessionRepository = {
      save: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
      findAll: vi.fn(),
      delete: vi.fn(),
    };
    const transcripts: TranscriptRepository = { append: vi.fn(), get: vi.fn() };
    const gateway = new CaptionsGateway(sessions, transcripts);
    const { client, emit, join } = buildClient();

    await gateway.handleJoin(client, { sessionId: SessionId.create().value, language: 'es' });

    expect(join).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('captions:error', expect.any(Object));
  });

  it('leaves the room on captions:leave', () => {
    const sessions: SessionRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      delete: vi.fn(),
    };
    const transcripts: TranscriptRepository = { append: vi.fn(), get: vi.fn() };
    const gateway = new CaptionsGateway(sessions, transcripts);
    const { client, leave } = buildClient();

    gateway.handleLeave(client, { sessionId: 'session-1', language: 'es' });

    expect(leave).toHaveBeenCalledWith('session:session-1:es');
  });
});
