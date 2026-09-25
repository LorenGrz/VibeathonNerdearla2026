import { describe, expect, it } from 'vitest';
import { LanguageCode } from '../language/language-code.js';
import { SessionId } from '../session/session-id.js';
import { InvalidArgumentError } from '../shared/errors.js';
import { sequentialIdGenerator } from '../shared/id-generator.js';
import { TimeRange } from './time-range.js';
import { Transcript } from './transcript.js';
import { TranscriptSegment } from './transcript-segment.js';

const sessionId = SessionId.of('s1');
const en = LanguageCode.of('en');
const es = LanguageCode.of('es');
const segIds = sequentialIdGenerator('seg');

const seg = (startMs: number, text: string, isFinal = true, id?: string) =>
  TranscriptSegment.original(
    {
      sessionId,
      language: en,
      text,
      range: TimeRange.of(startMs, startMs + 1000),
      isFinal,
      ...(id ? { id } : {}),
    },
    segIds,
  );

describe('TranscriptSegment', () => {
  it('creates an original segment and serializes it without sourceSegmentId', () => {
    const s = seg(0, 'hello', false, 'a');
    expect(s.kind).toBe('original');
    const dto = s.toDto();
    expect(dto).toEqual({
      id: 'a',
      sessionId: 's1',
      language: 'en',
      text: 'hello',
      startMs: 0,
      endMs: 1000,
      isFinal: false,
      kind: 'original',
    });
    expect('sourceSegmentId' in dto).toBe(false);
  });

  it('translate() produces a final translation linked to the source', () => {
    const ids = sequentialIdGenerator('t');
    const original = TranscriptSegment.original(
      { sessionId, language: en, text: 'hello', range: TimeRange.of(100, 900), isFinal: false },
      ids,
    );
    const translated = original.translate(es, 'hola');
    expect(translated.id).toBe('t-2');
    expect(translated.id).not.toBe(original.id);
    expect(translated.toDto()).toEqual({
      id: 't-2',
      sessionId: 's1',
      language: 'es',
      text: 'hola',
      startMs: 100,
      endMs: 900,
      isFinal: true,
      kind: 'translation',
      sourceSegmentId: 't-1',
    });
    expect(translated.range).toBe(original.range);
  });
});

describe('Transcript', () => {
  it('ignores partial segments', () => {
    const t = new Transcript(sessionId);
    t.add(seg(0, 'hel', false));
    t.add(seg(0, 'hello'));
    expect(t.forLanguage(en).map((s) => s.text)).toEqual(['hello']);
  });

  it('keeps segments ordered by startMs regardless of arrival order', () => {
    const t = new Transcript(sessionId);
    t.add(seg(3000, 'c'));
    t.add(seg(1000, 'a'));
    t.add(seg(2000, 'b'));
    t.add(seg(2000, 'b2'));
    expect(t.forLanguage(en).map((s) => s.text)).toEqual(['a', 'b', 'b2', 'c']);
  });

  it('filters by language', () => {
    const t = new Transcript(sessionId);
    const a = seg(0, 'hi');
    t.add(a);
    t.add(a.translate(es, 'hola'));
    expect(t.forLanguage(es).map((s) => s.text)).toEqual(['hola']);
    expect(t.forLanguage(en).map((s) => s.text)).toEqual(['hi']);
    expect(t.all()).toHaveLength(2);
  });

  it('replaces a segment re-added with the same id', () => {
    const t = new Transcript(sessionId);
    t.add(seg(0, 'first', true, 'x'));
    t.add(seg(0, 'second', true, 'x'));
    expect(t.forLanguage(en).map((s) => s.text)).toEqual(['second']);
  });

  it('rejects segments from another session', () => {
    const t = new Transcript(SessionId.of('other'));
    expect(() => t.add(seg(0, 'x'))).toThrow(InvalidArgumentError);
  });
});
