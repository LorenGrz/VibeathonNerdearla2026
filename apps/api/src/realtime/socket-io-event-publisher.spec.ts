import {
  LanguageCode,
  Session,
  SegmentTranscribed,
  SessionStarted,
  TimeRange,
  TranscriptSegment,
  fixedClock,
  sequentialIdGenerator,
  type SessionRepository,
} from '@subs/domain';
import type { CaptionsGateway } from './captions.gateway.js';
import { SocketIoEventPublisher } from './socket-io-event-publisher.js';

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

const buildGateway = () => {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  const gateway = { server: { to } } as unknown as CaptionsGateway;
  return { gateway, to, emit };
};

describe('SocketIoEventPublisher', () => {
  it('emits a caption to the segment language room', async () => {
    const { gateway, to, emit } = buildGateway();
    const session = buildSession();
    const sessions: SessionRepository = {
      save: vi.fn(),
      findById: vi.fn().mockResolvedValue(session),
      findAll: vi.fn(),
      delete: vi.fn(),
    };
    const publisher = new SocketIoEventPublisher(gateway, sessions);
    const segment = TranscriptSegment.original(
      {
        sessionId: session.id,
        language: LanguageCode.of('es'),
        text: 'Hola',
        range: TimeRange.of(0, 1000),
        isFinal: true,
      },
      sequentialIdGenerator('seg'),
    );

    await publisher.publish([new SegmentTranscribed(segment, new Date())]);

    expect(to).toHaveBeenCalledWith(`session:${session.id.value}:es`);
    expect(emit).toHaveBeenCalledWith('caption', segment.toDto());
  });

  it('broadcasts session:status to every language room on session events', async () => {
    const { gateway, to, emit } = buildGateway();
    const session = buildSession();
    session.start();
    session.pullEvents();
    const sessions: SessionRepository = {
      save: vi.fn(),
      findById: vi.fn().mockResolvedValue(session),
      findAll: vi.fn(),
      delete: vi.fn(),
    };
    const publisher = new SocketIoEventPublisher(gateway, sessions);

    await publisher.publish([new SessionStarted(session.id.value, new Date())]);

    expect(to).toHaveBeenCalledWith(`session:${session.id.value}:en`);
    expect(to).toHaveBeenCalledWith(`session:${session.id.value}:es`);
    expect(emit).toHaveBeenCalledWith('session:status', {
      id: session.id.value,
      status: 'starting',
    });
  });
});
