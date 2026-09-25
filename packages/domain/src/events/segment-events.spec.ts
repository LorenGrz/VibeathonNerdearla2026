import { describe, expect, it } from 'vitest';
import { LanguageCode } from '../language/language-code.js';
import { SessionId } from '../session/session-id.js';
import { TimeRange } from '../transcript/time-range.js';
import { TranscriptSegment } from '../transcript/transcript-segment.js';
import { SegmentTranscribed, SegmentTranslated } from './segment-events.js';

describe('segment events', () => {
  it('carry the segment and its session id', () => {
    const segment = TranscriptSegment.original({
      sessionId: SessionId.of('s9'),
      language: LanguageCode.of('en'),
      text: 'hi',
      range: TimeRange.of(0, 1),
      isFinal: true,
    });
    const at = new Date(0);
    const transcribed = new SegmentTranscribed(segment, at);
    const translated = new SegmentTranslated(segment.translate(LanguageCode.of('pt'), 'oi'), at);
    expect(transcribed).toMatchObject({ type: 'segment.transcribed', sessionId: 's9', segment });
    expect(translated).toMatchObject({ type: 'segment.translated', sessionId: 's9' });
  });
});
