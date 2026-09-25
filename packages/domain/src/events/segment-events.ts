import type { TranscriptSegment } from '../transcript/transcript-segment.js';
import type { DomainEvent } from './domain-event.js';

export class SegmentTranscribed implements DomainEvent {
  static readonly TYPE = 'segment.transcribed';
  readonly type = SegmentTranscribed.TYPE;
  readonly sessionId: string;
  constructor(
    readonly segment: TranscriptSegment,
    readonly occurredAt: Date,
  ) {
    this.sessionId = segment.sessionId.value;
  }
}

export class SegmentTranslated implements DomainEvent {
  static readonly TYPE = 'segment.translated';
  readonly type = SegmentTranslated.TYPE;
  readonly sessionId: string;
  constructor(
    readonly segment: TranscriptSegment,
    readonly occurredAt: Date,
  ) {
    this.sessionId = segment.sessionId.value;
  }
}
