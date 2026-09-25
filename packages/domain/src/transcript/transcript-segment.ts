import type { CaptionDto, SegmentKind } from '../contracts/dto.js';
import type { LanguageCode } from '../language/language-code.js';
import type { SessionId } from '../session/session-id.js';
import { randomIdGenerator, type IdGenerator } from '../shared/id-generator.js';
import type { TimeRange } from './time-range.js';

export type { SegmentKind } from '../contracts/dto.js';

export interface OriginalSegmentProps {
  sessionId: SessionId;
  language: LanguageCode;
  text: string;
  range: TimeRange;
  isFinal: boolean;
  /** Optional explicit id (e.g. to update a partial in place). Generated otherwise. */
  id?: string;
}

export class TranscriptSegment {
  private constructor(
    readonly id: string,
    readonly sessionId: SessionId,
    readonly language: LanguageCode,
    readonly text: string,
    readonly range: TimeRange,
    readonly isFinal: boolean,
    readonly kind: SegmentKind,
    readonly sourceSegmentId: string | undefined,
    private readonly ids: IdGenerator,
  ) {}

  static original(
    p: OriginalSegmentProps,
    ids: IdGenerator = randomIdGenerator,
  ): TranscriptSegment {
    return new TranscriptSegment(
      p.id ?? ids.next(),
      p.sessionId,
      p.language,
      p.text,
      p.range,
      p.isFinal,
      'original',
      undefined,
      ids,
    );
  }

  /** kind=translation, sourceSegmentId=this.id, same range, isFinal=true. */
  translate(target: LanguageCode, text: string): TranscriptSegment {
    return new TranscriptSegment(
      this.ids.next(),
      this.sessionId,
      target,
      text,
      this.range,
      true,
      'translation',
      this.id,
      this.ids,
    );
  }

  toDto(): CaptionDto {
    const dto: CaptionDto = {
      id: this.id,
      sessionId: this.sessionId.value,
      language: this.language.value,
      text: this.text,
      startMs: this.range.startMs,
      endMs: this.range.endMs,
      isFinal: this.isFinal,
      kind: this.kind,
    };
    if (this.sourceSegmentId !== undefined) dto.sourceSegmentId = this.sourceSegmentId;
    return dto;
  }
}
