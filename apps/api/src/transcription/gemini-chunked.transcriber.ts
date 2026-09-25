/**
 * Fallback `TranscriberPort`: buffers ~4 s of PCM, wraps it in WAV and asks a Gemini text model
 * (`generateContent` with inline `audio/wav`) for a literal transcript. Emits finals only.
 * Requests are serialized so segments come out in audio order. A failed window is logged and
 * skipped (the stream keeps going); `close()` flushes the tail, abort drops it.
 */
import { Logger } from '@nestjs/common';
import {
  TimeRange,
  TranscriptSegment,
  randomIdGenerator,
  type AbortSignalLike,
  type AudioChunk,
  type Glossary,
  type IdGenerator,
  type LanguageCode,
  type SessionId,
  type TranscriberPort,
  type TranscriberStream,
} from '@subs/domain';
import { AsyncQueue } from './async-queue.js';
import type { GeminiContentClient } from './gemini.client.js';
import { LANGUAGE_NAMES, normalizeText, vocabularyFrom } from './language-hints.js';
import { concatBytes, pcmToWav, toBase64 } from './wav.js';

export interface GeminiChunkedTranscriberOptions {
  model: string;
  /** Audio per request. Default 4000 ms. */
  windowMs?: number;
  /** Tail shorter than this is dropped on close. Default 300 ms. */
  minFlushMs?: number;
  ids?: IdGenerator;
  logger?: Pick<Logger, 'warn'>;
}

interface TranscribeParams {
  sessionId: SessionId;
  language: LanguageCode;
  glossary: Glossary;
  signal: AbortSignalLike;
}

export function buildTranscriptionPrompt(language: LanguageCode, glossary: Glossary): string {
  const lines = [
    `Transcribe this audio literally in ${LANGUAGE_NAMES[language.value]}.`,
    'Output only the transcript text: no comments, no timestamps, no speaker labels, no quotes.',
    'If there is no intelligible speech, output nothing.',
  ];
  const vocabulary = vocabularyFrom(glossary);
  if (vocabulary.length > 0) {
    lines.push(`These terms may appear; spell them exactly: ${vocabulary.join(', ')}.`);
  }
  return lines.join('\n');
}

export class GeminiChunkedTranscriber implements TranscriberPort {
  private readonly windowMs: number;
  private readonly minFlushMs: number;
  private readonly ids: IdGenerator;
  private readonly logger: Pick<Logger, 'warn'>;

  constructor(
    private readonly client: GeminiContentClient,
    private readonly options: GeminiChunkedTranscriberOptions,
  ) {
    this.windowMs = options.windowMs ?? 4000;
    this.minFlushMs = options.minFlushMs ?? 300;
    this.ids = options.ids ?? randomIdGenerator;
    this.logger = options.logger ?? new Logger(GeminiChunkedTranscriber.name);
  }

  open(p: TranscribeParams): Promise<TranscriberStream> {
    return Promise.resolve(
      new ChunkedStream(p, {
        client: this.client,
        model: this.options.model,
        windowMs: this.windowMs,
        minFlushMs: this.minFlushMs,
        ids: this.ids,
        logger: this.logger,
      }),
    );
  }
}

interface ChunkedDeps {
  client: GeminiContentClient;
  model: string;
  windowMs: number;
  minFlushMs: number;
  ids: IdGenerator;
  logger: Pick<Logger, 'warn'>;
}

class ChunkedStream implements TranscriberStream {
  private readonly queue = new AsyncQueue<TranscriptSegment>();
  private readonly prompt: string;
  private buffer: AudioChunk[] = [];
  private bufferedMs = 0;
  private pending: Promise<void> = Promise.resolve();
  private closed = false;
  private aborted = false;
  private closing: Promise<void> | null = null;
  private readonly onAbort = () => this.abort();

  constructor(
    private readonly p: TranscribeParams,
    private readonly deps: ChunkedDeps,
  ) {
    this.prompt = buildTranscriptionPrompt(p.language, p.glossary);
    if (p.signal.aborted) this.abort();
    else p.signal.addEventListener('abort', this.onAbort, { once: true });
  }

  push(chunk: AudioChunk): void {
    if (this.closed) return;
    this.buffer.push(chunk);
    this.bufferedMs += chunk.durationMs;
    if (this.bufferedMs >= this.deps.windowMs) this.flush();
  }

  segments(): AsyncIterable<TranscriptSegment> {
    return this.queue;
  }

  close(): Promise<void> {
    this.closing ??= this.shutdown();
    return this.closing;
  }

  private async shutdown(): Promise<void> {
    this.closed = true;
    this.p.signal.removeEventListener('abort', this.onAbort);
    if (this.bufferedMs >= this.deps.minFlushMs) this.flush();
    await this.pending;
    this.queue.end();
  }

  private abort(): void {
    this.aborted = true;
    this.closed = true;
    this.buffer = [];
    this.bufferedMs = 0;
    this.queue.end();
    this.closing ??= Promise.resolve();
  }

  private flush(): void {
    const chunks = this.buffer;
    this.buffer = [];
    this.bufferedMs = 0;
    if (chunks.length === 0) return;
    this.pending = this.pending.then(() => this.transcribe(chunks));
  }

  private async transcribe(chunks: AudioChunk[]): Promise<void> {
    if (this.aborted) return;
    const startMs = Math.min(...chunks.map((c) => c.offsetMs));
    const endMs = Math.max(...chunks.map((c) => c.offsetMs + c.durationMs));
    const wav = pcmToWav(concatBytes(chunks.map((c) => c.data)));
    try {
      const response = await this.deps.client.generateContent({
        model: this.deps.model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: this.prompt },
              { inlineData: { mimeType: 'audio/wav', data: toBase64(wav) } },
            ],
          },
        ],
        config: { temperature: 0 },
      });
      const text = normalizeText(response.text ?? '');
      if (!text || this.aborted) return;
      this.queue.push(
        TranscriptSegment.original(
          {
            sessionId: this.p.sessionId,
            language: this.p.language,
            text,
            range: TimeRange.of(startMs, endMs),
            isFinal: true,
          },
          this.deps.ids,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.deps.logger.warn(`Chunked transcription failed for ${startMs}-${endMs} ms: ${message}`);
    }
  }
}
