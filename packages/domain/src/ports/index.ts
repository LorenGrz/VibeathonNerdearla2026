import type { AudioSourceSpec } from '../contracts/dto.js';
import type { DomainEvent } from '../events/domain-event.js';
import type { Glossary } from '../glossary/glossary.js';
import type { LanguageCode } from '../language/language-code.js';
import type { Session } from '../session/session.js';
import type { SessionId } from '../session/session-id.js';
import type { Transcript } from '../transcript/transcript.js';
import type { TranscriptSegment } from '../transcript/transcript-segment.js';

/**
 * Structural subset of the WHATWG/Node `AbortSignal`. The domain compiles with `lib: ES2023`
 * and no ambient types, so the global type is not visible here; a real `AbortSignal` is
 * assignable to this, and adapters may annotate the parameter as `AbortSignal`.
 */
export interface AbortSignalLike {
  readonly aborted: boolean;
  readonly reason?: unknown;
  addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}

/** PCM s16le 16 kHz mono. */
export interface AudioChunk {
  data: Uint8Array;
  offsetMs: number;
  durationMs: number;
}

export const AUDIO_FORMAT = { sampleRate: 16000, channels: 1, encoding: 's16le' } as const;

export interface AudioSourcePort {
  open(spec: AudioSourceSpec, signal: AbortSignalLike): AsyncIterable<AudioChunk>;
}

export interface TranscriberStream {
  push(chunk: AudioChunk): void;
  /** Partials and finals. */
  segments(): AsyncIterable<TranscriptSegment>;
  close(): Promise<void>;
}

export interface TranscriberPort {
  open(p: {
    sessionId: SessionId;
    language: LanguageCode;
    glossary: Glossary;
    signal: AbortSignalLike;
  }): Promise<TranscriberStream>;
}

export interface TranslatorPort {
  translate(
    segment: TranscriptSegment,
    target: LanguageCode,
    glossary: Glossary,
  ): Promise<TranscriptSegment>;
}

export interface SessionRepository {
  save(s: Session): Promise<void>;
  findById(id: SessionId): Promise<Session | null>;
  findAll(): Promise<Session[]>;
  delete(id: SessionId): Promise<void>;
}

export interface TranscriptRepository {
  append(segment: TranscriptSegment): Promise<void>;
  get(sessionId: SessionId): Promise<Transcript>;
}

export interface EventPublisherPort {
  publish(events: DomainEvent[]): Promise<void>;
}

export interface SessionRunner {
  start(id: SessionId): Promise<void>;
  stop(id: SessionId): Promise<void>;
}
