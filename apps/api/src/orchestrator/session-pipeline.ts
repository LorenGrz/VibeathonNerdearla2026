import {
  SegmentTranscribed,
  SegmentTranslated,
  type AudioSourcePort,
  type Clock,
  type DomainEvent,
  type EventPublisherPort,
  type Session,
  type TranscriberPort,
  type TranscriberStream,
  type TranscriptRepository,
  type TranscriptSegment,
  type TranslatorPort,
} from '@subs/domain';
import { errorMessage } from './async-utils.js';

export interface PipelineDeps {
  audio: AudioSourcePort;
  transcriber: TranscriberPort;
  translator: TranslatorPort;
  transcripts: TranscriptRepository;
  publisher: EventPublisherPort;
  clock: Clock;
  logger: { warn(message: string): void };
}

/**
 * Audio -> transcriber -> (persist, publish, translate) for ONE session. Holds no global state,
 * so sessions are isolated by construction. Session status transitions are NOT done here: the
 * orchestrator owns them.
 */
export class SessionPipeline {
  private readonly inflight = new Set<Promise<void>>();
  /** Wall-clock ms that corresponds to audio offset 0 of the current attempt. */
  private epochMs: number | null = null;

  constructor(
    private readonly session: Session,
    private readonly deps: PipelineDeps,
  ) {}

  /**
   * One attempt. Resolves when the audio source ends (after flushing the transcriber and
   * pending translations) or when `signal` aborts. Rejects if the transcriber or the source fail.
   * `onFirstChunk` fires once, when the first audio chunk has been pushed.
   */
  async runOnce(signal: AbortSignal, onFirstChunk: () => Promise<void>): Promise<void> {
    if (signal.aborted) return;
    const attempt = new AbortController();
    const forwardAbort = (): void => attempt.abort(signal.reason);
    signal.addEventListener('abort', forwardAbort, { once: true });
    this.epochMs = null;

    let stream: TranscriberStream | undefined;
    let consumer: Promise<void> | undefined;
    let consumerFailure: { error: unknown } | undefined;
    try {
      stream = await this.deps.transcriber.open({
        sessionId: this.session.id,
        language: this.session.sourceLanguage,
        glossary: this.session.glossary,
        signal: attempt.signal,
      });
      const opened = stream;
      consumer = this.consume(opened, signal).catch((error: unknown) => {
        consumerFailure = { error };
        attempt.abort(error); // unblocks the audio loop so the attempt can be retried
      });

      for await (const chunk of this.deps.audio.open(this.session.source, attempt.signal)) {
        if (attempt.signal.aborted) break;
        this.session.metrics.recordChunk(chunk.data.byteLength);
        opened.push(chunk);
        if (this.epochMs === null) {
          this.epochMs = this.deps.clock.now().getTime() - chunk.offsetMs;
          await onFirstChunk();
        }
      }
    } catch (error) {
      // A consumer failure aborts the source, which may surface as an AbortError here: report
      // the root cause instead.
      if (!consumerFailure) throw error;
    } finally {
      signal.removeEventListener('abort', forwardAbort);
      if (stream) await this.closeQuietly(stream);
      await consumer;
      await this.drainTranslations();
      attempt.abort();
    }
    if (consumerFailure) throw consumerFailure.error;
  }

  private async consume(stream: TranscriberStream, signal: AbortSignal): Promise<void> {
    for await (const segment of stream.segments()) {
      if (signal.aborted) break; // stopped: drop whatever the transcriber still flushes
      await this.handle(segment);
    }
  }

  private async handle(segment: TranscriptSegment): Promise<void> {
    if (!segment.isFinal) {
      await this.publish([new SegmentTranscribed(segment, this.deps.clock.now())]);
      return;
    }
    try {
      await this.deps.transcripts.append(segment);
    } catch (error) {
      this.recordError(`persist segment failed: ${errorMessage(error)}`);
    }
    this.recordLatency(segment);
    await this.publish([new SegmentTranscribed(segment, this.deps.clock.now())]);

    // Translations run in the background so a slow translator never stalls transcription.
    const task: Promise<void> = this.translateAll(segment).finally(() =>
      this.inflight.delete(task),
    );
    this.inflight.add(task);
  }

  private async translateAll(segment: TranscriptSegment): Promise<void> {
    const targets = this.session.targetLanguages.filter((t) => !t.equals(segment.language));
    const results = await Promise.allSettled(
      targets.map(async (target) => {
        const translated = await this.deps.translator.translate(
          segment,
          target,
          this.session.glossary,
        );
        await this.deps.transcripts.append(translated);
        await this.publish([new SegmentTranslated(translated, this.deps.clock.now())]);
      }),
    );
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        this.recordError(
          `translation to ${targets[i]?.value ?? '?'} failed: ${errorMessage(result.reason)}`,
        );
      }
    });
  }

  private recordLatency(segment: TranscriptSegment): void {
    if (this.epochMs === null) return;
    const audioEndAt = this.epochMs + segment.range.endMs;
    this.session.metrics.recordLatency(this.deps.clock.now().getTime() - audioEndAt);
  }

  private async publish(events: DomainEvent[]): Promise<void> {
    try {
      await this.deps.publisher.publish(events);
    } catch (error) {
      this.recordError(`publish failed: ${errorMessage(error)}`);
    }
  }

  private async drainTranslations(): Promise<void> {
    while (this.inflight.size > 0) await Promise.allSettled(this.inflight);
  }

  private async closeQuietly(stream: TranscriberStream): Promise<void> {
    try {
      await stream.close();
    } catch (error) {
      this.deps.logger.warn(
        `[${this.session.id.value}] transcriber close failed: ${errorMessage(error)}`,
      );
    }
  }

  private recordError(message: string): void {
    this.session.metrics.recordError(message);
    this.deps.logger.warn(`[${this.session.id.value}] ${message}`);
  }
}
