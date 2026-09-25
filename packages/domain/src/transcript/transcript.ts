import type { LanguageCode } from '../language/language-code.js';
import type { SessionId } from '../session/session-id.js';
import { InvalidArgumentError } from '../shared/errors.js';
import type { TranscriptSegment } from './transcript-segment.js';

export class Transcript {
  private readonly segments: TranscriptSegment[] = [];

  constructor(readonly sessionId: SessionId) {}

  /**
   * Only final segments are kept; partials are ignored. Keeps segments sorted by startMs
   * (stable for equal starts). Re-adding a segment with the same id replaces it.
   */
  add(segment: TranscriptSegment): void {
    if (!segment.isFinal) return;
    if (!segment.sessionId.equals(this.sessionId)) {
      throw new InvalidArgumentError(
        `Segment belongs to session ${segment.sessionId.value}, not ${this.sessionId.value}`,
      );
    }
    const existing = this.segments.findIndex((s) => s.id === segment.id);
    if (existing !== -1) this.segments.splice(existing, 1);
    let i = this.segments.length;
    while (i > 0 && (this.segments[i - 1]?.range.startMs ?? 0) > segment.range.startMs) i--;
    this.segments.splice(i, 0, segment);
  }

  forLanguage(lang: LanguageCode): readonly TranscriptSegment[] {
    return this.segments.filter((s) => s.language.equals(lang));
  }

  all(): readonly TranscriptSegment[] {
    return [...this.segments];
  }
}
