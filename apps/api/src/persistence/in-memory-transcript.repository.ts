import { Injectable } from '@nestjs/common';
import {
  Transcript,
  type SessionId,
  type TranscriptRepository,
  type TranscriptSegment,
} from '@subs/domain';

/** One `Transcript` per session; partial segments are dropped by `Transcript.add`. */
@Injectable()
export class InMemoryTranscriptRepository implements TranscriptRepository {
  private readonly transcripts = new Map<string, Transcript>();

  append(segment: TranscriptSegment): Promise<void> {
    this.transcriptFor(segment.sessionId).add(segment);
    return Promise.resolve();
  }

  get(sessionId: SessionId): Promise<Transcript> {
    return Promise.resolve(this.transcriptFor(sessionId));
  }

  private transcriptFor(sessionId: SessionId): Transcript {
    let transcript = this.transcripts.get(sessionId.value);
    if (!transcript) {
      transcript = new Transcript(sessionId);
      this.transcripts.set(sessionId.value, transcript);
    }
    return transcript;
  }
}
