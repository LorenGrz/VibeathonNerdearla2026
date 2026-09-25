import { describe, expect, it } from 'vitest';
import { fixedClock } from '../shared/clock.js';
import {
  DomainError,
  InvalidArgumentError,
  InvalidSessionTransitionError,
} from '../shared/errors.js';
import { sequentialIdGenerator } from '../shared/id-generator.js';
import { LanguageCode } from '../language/language-code.js';
import { Glossary, GlossaryTerm } from '../glossary/glossary.js';
import { SessionFailed, SessionLive, SessionStarted, SessionStopped } from '../events/index.js';
import { Session, type SessionStatus } from './session.js';

const en = LanguageCode.of('en');
const es = LanguageCode.of('es');
const pt = LanguageCode.of('pt');

const make = (targets = [es, pt]) => {
  const clock = fixedClock('2026-01-01T00:00:00.000Z');
  const session = Session.create(
    {
      title: 'Keynote',
      stage: 'Main',
      sourceLanguage: en,
      targetLanguages: targets,
      source: { kind: 'file', path: 'talk.wav' },
    },
    { clock, ids: sequentialIdGenerator('s') },
  );
  return { session, clock };
};

const driveTo = (session: Session, status: SessionStatus): void => {
  if (status === 'idle') return;
  if (status === 'error') return session.fail('boom');
  session.start();
  if (status === 'starting') return;
  if (status === 'live' || status === 'stopped') session.markLive();
  if (status === 'stopped') session.stop();
};

describe('Session', () => {
  it('is created idle with an injected id and empty glossary', () => {
    const { session } = make();
    expect(session.id.value).toBe('s-1');
    expect(session.status).toBe('idle');
    expect(session.glossary.terms()).toHaveLength(0);
    expect(session.pullEvents()).toEqual([]);
  });

  it('rejects an empty title', () => {
    expect(() =>
      Session.create({
        title: '  ',
        stage: 'x',
        sourceLanguage: en,
        targetLanguages: [],
        source: { kind: 'mic' },
      }),
    ).toThrow(InvalidArgumentError);
  });

  it('generates a random uuid by default', () => {
    const s = Session.create({
      title: 't',
      stage: 's',
      sourceLanguage: en,
      targetLanguages: [],
      source: { kind: 'mic' },
    });
    expect(s.id.value).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('follows the happy path idle -> starting -> live -> stopped -> starting', () => {
    const { session } = make();
    session.start();
    expect(session.status).toBe('starting');
    session.markLive();
    expect(session.status).toBe('live');
    session.stop();
    expect(session.status).toBe('stopped');
    session.start();
    expect(session.status).toBe('starting');
  });

  it('allows stopping while starting and restarting after error', () => {
    const { session } = make();
    session.start();
    session.stop();
    expect(session.status).toBe('stopped');
    session.fail('x');
    expect(session.status).toBe('error');
    expect(session.failureReason).toBe('x');
    session.start();
    expect(session.status).toBe('starting');
    expect(session.failureReason).toBeNull();
  });

  it.each<SessionStatus>(['idle', 'starting', 'live', 'stopped', 'error'])(
    'fail() is allowed from %s',
    (from) => {
      const { session } = make();
      driveTo(session, from);
      session.fail('err');
      expect(session.status).toBe('error');
    },
  );

  const invalid: [SessionStatus, 'start' | 'markLive' | 'stop'][] = [
    ['starting', 'start'],
    ['live', 'start'],
    ['idle', 'markLive'],
    ['live', 'markLive'],
    ['stopped', 'markLive'],
    ['error', 'markLive'],
    ['idle', 'stop'],
    ['stopped', 'stop'],
    ['error', 'stop'],
  ];
  it.each(invalid)('rejects %s -> %s', (from, action) => {
    const { session } = make();
    driveTo(session, from);
    session.pullEvents();
    let error: unknown;
    try {
      session[action]();
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(InvalidSessionTransitionError);
    expect(error).toBeInstanceOf(DomainError);
    expect(session.status).toBe(from);
    expect(session.pullEvents()).toEqual([]);
  });

  it('records events in order and pullEvents() drains them', () => {
    const { session, clock } = make();
    session.start();
    clock.set(new Date('2026-01-01T00:00:01.000Z'));
    session.markLive();
    session.fail('network');
    session.start();
    session.stop();

    const events = session.pullEvents();
    expect(events.map((e) => e.constructor)).toEqual([
      SessionStarted,
      SessionLive,
      SessionFailed,
      SessionStarted,
      SessionStopped,
    ]);
    expect(events.map((e) => e.type)).toEqual([
      'session.started',
      'session.live',
      'session.failed',
      'session.started',
      'session.stopped',
    ]);
    expect(events.every((e) => e.sessionId === 's-1')).toBe(true);
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(events[1]?.occurredAt.toISOString()).toBe('2026-01-01T00:00:01.000Z');
    expect((events[2] as SessionFailed).reason).toBe('network');
    expect(session.pullEvents()).toEqual([]);
  });

  it('languages() returns source + targets without duplicates', () => {
    const { session } = make([es, en, LanguageCode.of('ES'), pt]);
    expect(session.languages().map(String)).toEqual(['en', 'es', 'pt']);
    expect(session.targetLanguages.map(String)).toEqual(['es', 'en', 'pt']);
  });

  it('toSnapshot() returns a plain SessionDto', () => {
    const { session } = make();
    session.metrics.recordChunk(3200);
    session.start();
    const snapshot = session.toSnapshot();
    expect(snapshot).toEqual({
      id: 's-1',
      title: 'Keynote',
      stage: 'Main',
      sourceLanguage: 'en',
      targetLanguages: ['es', 'pt'],
      source: { kind: 'file', path: 'talk.wav' },
      status: 'starting',
      metrics: {
        chunksIn: 1,
        bytesIn: 3200,
        latencyP50Ms: null,
        latencyP95Ms: null,
        errors: 0,
        lastError: null,
        lastActivityAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('fail() is reflected in metrics', () => {
    const { session } = make();
    session.fail('ffmpeg crashed');
    expect(session.toSnapshot().metrics).toMatchObject({ errors: 1, lastError: 'ffmpeg crashed' });
  });

  it('keeps a provided glossary', () => {
    const glossary = new Glossary([new GlossaryTerm('keynote', { es: 'conferencia' })]);
    const s = Session.create({
      title: 't',
      stage: 's',
      sourceLanguage: en,
      targetLanguages: [es],
      source: { kind: 'url', url: 'https://x/y.m3u8' },
      glossary,
    });
    expect(s.glossary).toBe(glossary);
  });
});
