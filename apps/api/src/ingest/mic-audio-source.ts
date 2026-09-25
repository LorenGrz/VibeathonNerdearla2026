import type { AudioChunk, AudioSourceSpec } from '@subs/domain';
import { AUDIO_FORMAT } from '@subs/domain';
import type { AudioSourceContext, ContextualAudioSource } from './audio-source-context.js';

export const MIC_CHUNK_MS = 100;
const BYTES_PER_SAMPLE = 2; // s16le
export const MIC_CHUNK_BYTES =
  (AUDIO_FORMAT.sampleRate * AUDIO_FORMAT.channels * BYTES_PER_SAMPLE * MIC_CHUNK_MS) / 1000;
const DEFAULT_MAX_QUEUE_MS = 2000;

export interface MicAudioSourceOptions {
  /** Audio kept per session while the consumer is slower than the browser. Default 2000 ms. */
  maxQueueMs?: number;
}

/**
 * One consumer run (= one `open()` call): re-slices incoming PCM into 100 ms chunks with an
 * increasing `offsetMs` and keeps at most `maxChunks` of them, dropping the OLDEST on overflow
 * (live captions prefer fresh audio over complete audio).
 */
class MicStream {
  private readonly queue: AudioChunk[] = [];
  private pending: Uint8Array = new Uint8Array(0);
  private offsetMs = 0;
  private wake: (() => void) | null = null;
  private closed = false;
  droppedChunks = 0;

  constructor(private readonly maxChunks: number) {}

  write(data: Uint8Array): void {
    if (this.closed || data.byteLength === 0) return;
    const merged = new Uint8Array(this.pending.byteLength + data.byteLength);
    merged.set(this.pending, 0);
    merged.set(data, this.pending.byteLength);
    let cursor = 0;
    while (merged.byteLength - cursor >= MIC_CHUNK_BYTES) {
      this.queue.push({
        data: merged.slice(cursor, cursor + MIC_CHUNK_BYTES),
        offsetMs: this.offsetMs,
        durationMs: MIC_CHUNK_MS,
      });
      this.offsetMs += MIC_CHUNK_MS;
      cursor += MIC_CHUNK_BYTES;
    }
    this.pending = merged.slice(cursor);
    while (this.queue.length > this.maxChunks) {
      this.queue.shift();
      this.droppedChunks += 1;
    }
    this.notify();
  }

  close(): void {
    this.closed = true;
    this.notify();
  }

  async *chunks(): AsyncGenerator<AudioChunk> {
    while (true) {
      const next = this.queue.shift();
      if (next) {
        yield next;
        continue;
      }
      if (this.closed) return;
      await new Promise<void>((resolve) => {
        this.wake = resolve;
      });
    }
  }

  private notify(): void {
    const wake = this.wake;
    this.wake = null;
    wake?.();
  }
}

/**
 * `AudioSourcePort` for `{ kind: 'mic' }`: PCM s16le 16 kHz mono pushed by a browser through
 * `MicGateway` (`/mic`). Two independent registries keyed by session id:
 * - emitter: which socket may feed the session (exactly one at a time);
 * - stream: the pipeline currently consuming the session (the latest `open()` wins).
 * Audio pushed while no pipeline is consuming is dropped: there is nothing to caption yet.
 * The iterable only ends when `signal` aborts, so a browser reconnect does not stop the session.
 */
export class MicAudioSource implements ContextualAudioSource {
  private readonly emitters = new Map<string, string>();
  private readonly streams = new Map<string, MicStream>();
  private readonly maxChunks: number;

  constructor(options: MicAudioSourceOptions = {}) {
    const maxQueueMs = options.maxQueueMs ?? DEFAULT_MAX_QUEUE_MS;
    this.maxChunks = Math.max(1, Math.floor(maxQueueMs / MIC_CHUNK_MS));
  }

  /** Claims the session for `emitterId`. False if another emitter already owns it. Idempotent. */
  claim(sessionId: string, emitterId: string): boolean {
    const owner = this.emitters.get(sessionId);
    if (owner !== undefined && owner !== emitterId) return false;
    this.emitters.set(sessionId, emitterId);
    return true;
  }

  /** Releases the session only if `emitterId` owns it. */
  release(sessionId: string, emitterId: string): void {
    if (this.emitters.get(sessionId) === emitterId) this.emitters.delete(sessionId);
  }

  emitterOf(sessionId: string): string | undefined {
    return this.emitters.get(sessionId);
  }

  /**
   * Feeds PCM bytes from `emitterId`. Returns false (and drops the data) if that emitter does
   * not own the session. Returns true otherwise, even if no pipeline is consuming yet.
   */
  push(sessionId: string, emitterId: string, data: Uint8Array): boolean {
    if (this.emitters.get(sessionId) !== emitterId) return false;
    this.streams.get(sessionId)?.write(data);
    return true;
  }

  /** Chunks dropped by backpressure in the current run of `sessionId` (diagnostics/tests). */
  droppedChunks(sessionId: string): number {
    return this.streams.get(sessionId)?.droppedChunks ?? 0;
  }

  async *open(
    spec: AudioSourceSpec,
    signal: AbortSignal,
    context?: AudioSourceContext,
  ): AsyncGenerator<AudioChunk> {
    if (spec.kind !== 'mic') {
      throw new Error(`MicAudioSource cannot open "${spec.kind}" sources`);
    }
    if (!context?.sessionId) {
      throw new Error('MicAudioSource.open requires context.sessionId');
    }
    if (signal.aborted) return;

    const { sessionId } = context;
    const stream = new MicStream(this.maxChunks);
    this.streams.get(sessionId)?.close(); // a retry supersedes the previous run
    this.streams.set(sessionId, stream);
    const onAbort = (): void => stream.close();
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      yield* stream.chunks();
    } finally {
      signal.removeEventListener('abort', onAbort);
      stream.close();
      if (this.streams.get(sessionId) === stream) this.streams.delete(sessionId);
    }
  }
}
