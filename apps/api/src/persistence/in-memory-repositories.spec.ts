import {
  LanguageCode,
  Session,
  SessionId,
  TimeRange,
  TranscriptSegment,
  sequentialIdGenerator,
} from '@subs/domain';
import { InMemorySessionRepository } from './in-memory-session.repository.js';
import { InMemoryTranscriptRepository } from './in-memory-transcript.repository.js';

const en = LanguageCode.of('en');

const makeSession = (title: string) =>
  Session.create({
    title,
    stage: 'Main',
    sourceLanguage: en,
    targetLanguages: [],
    source: { kind: 'mic' },
  });

describe('InMemorySessionRepository', () => {
  it('saves, finds, lists and deletes sessions', async () => {
    const repo = new InMemorySessionRepository();
    const a = makeSession('a');
    const b = makeSession('b');
    await repo.save(a);
    await repo.save(b);
    await repo.save(a);

    expect(await repo.findById(a.id)).toBe(a);
    expect(await repo.findById(SessionId.of('missing'))).toBeNull();
    expect((await repo.findAll()).map((s) => s.title)).toEqual(['a', 'b']);

    await repo.delete(a.id);
    expect(await repo.findById(a.id)).toBeNull();
    expect(await repo.findAll()).toEqual([b]);
  });
});

describe('InMemoryTranscriptRepository', () => {
  const ids = sequentialIdGenerator('seg');
  const seg = (sessionId: SessionId, text: string, isFinal = true) =>
    TranscriptSegment.original(
      { sessionId, language: en, text, range: TimeRange.of(0, 100), isFinal },
      ids,
    );

  it('keeps one transcript per session and only final segments', async () => {
    const repo = new InMemoryTranscriptRepository();
    const s1 = SessionId.of('s1');
    const s2 = SessionId.of('s2');
    await repo.append(seg(s1, 'hel', false));
    await repo.append(seg(s1, 'hello'));
    await repo.append(seg(s2, 'other'));

    expect((await repo.get(s1)).all().map((s) => s.text)).toEqual(['hello']);
    expect((await repo.get(s2)).all().map((s) => s.text)).toEqual(['other']);
  });

  it('returns an empty transcript for an unknown session', async () => {
    const repo = new InMemoryTranscriptRepository();
    const transcript = await repo.get(SessionId.of('none'));
    expect(transcript.sessionId.value).toBe('none');
    expect(transcript.all()).toEqual([]);
  });
});
