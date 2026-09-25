/**
 * `TranscriberPort` over the Gemini Live API (input audio transcription).
 *
 * Model: `gemini-3.5-transcribe-live` (dedicated live speech-to-text, `responseModalities: [TEXT]`).
 * `gemini-live-2.5-flash-preview` was shut down on 2025-12-09 (Gemini deprecations page).
 *
 * Segmentation:
 * - `interimInputTranscription` (partial hypothesis of the current utterance) -> partial segment.
 * - `inputTranscription` (finalized utterance) -> final segment. Models that do not send interim
 *   hypotheses stream `inputTranscription` as deltas instead; those are accumulated and finalized on
 *   `finished`, `turnComplete`, `silenceMs` without new text, or `maxSegmentMs` of audio.
 * - Partials and the final of one utterance share the same segment id (update in place).
 * - Time range: audio position (from chunk `offsetMs`) where the utterance started -> latest audio
 *   pushed when it was emitted. Utterance-level only; the Live API gives no word timestamps.
 *
 * Reconnection: on `goAway` or an unexpected close the pending text is finalized, a new connection
 * is opened and audio pushed meanwhile is buffered (bounded) and replayed. The `segments()`
 * iterable is not interrupted. Session resumption is opt-in (`useSessionResumption`): for pure
 * transcription there is no conversational state worth restoring, so a fresh connection is
 * equivalent and avoids depending on resumption support of the transcribe model.
 */
import { Logger } from '@nestjs/common';
import { Modality, type LiveConnectConfig } from '@google/genai';
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
import type { GeminiLiveClient, GeminiLiveMessage, GeminiLiveSession } from './gemini.client.js';
import { LIVE_LANGUAGE_CODES, normalizeText, vocabularyFrom } from './language-hints.js';
import { toBase64 } from './wav.js';

export const DEFAULT_GEMINI_LIVE_MODEL = 'gemini-3.5-transcribe-live';
export const LIVE_AUDIO_MIME_TYPE = 'audio/pcm;rate=16000';

export interface GeminiLiveTranscriberOptions {
  model: string;
  /** Finalize after this long without new text (delta mode). Default 700 ms. */
  silenceMs?: number;
  /**
   * Fallback finalize when the server sends interim hypotheses but no final. Default 15 000 ms:
   * under load Gemini can pause several seconds between hypotheses, and a shorter timer splits an
   * utterance into one-word captions (and one translation call per word).
   */
  interimSilenceMs?: number;
  /** Force a final once an utterance spans this much audio. Default 12 000 ms. */
  maxSegmentMs?: number;
  /** Consecutive failed reconnects before the stream fails. Default 5. */
  maxReconnectAttempts?: number;
  /** Linear backoff base between reconnect attempts. Default 500 ms. */
  reconnectDelayMs?: number;
  /**
   * Utterance start = audio position at first text minus this (ASR latency), never before the
   * previous final. Default 1000 ms.
   */
  firstTextLookbackMs?: number;
  /** Audio kept while reconnecting; older chunks are dropped. Default 10 000 ms. */
  maxBufferedAudioMs?: number;
  useSessionResumption?: boolean;
  ids?: IdGenerator;
  logger?: Pick<Logger, 'warn' | 'log'>;
}

type ResolvedOptions = Required<Omit<GeminiLiveTranscriberOptions, 'ids' | 'logger'>> & {
  ids: IdGenerator;
  logger: Pick<Logger, 'warn' | 'log'>;
};

export class GeminiLiveTranscriber implements TranscriberPort {
  private readonly options: ResolvedOptions;

  constructor(
    private readonly client: GeminiLiveClient,
    options: GeminiLiveTranscriberOptions,
  ) {
    this.options = {
      silenceMs: 700,
      interimSilenceMs: 15_000,
      maxSegmentMs: 12_000,
      maxReconnectAttempts: 5,
      reconnectDelayMs: 500,
      maxBufferedAudioMs: 10_000,
      firstTextLookbackMs: 1000,
      useSessionResumption: false,
      ids: randomIdGenerator,
      logger: new Logger(GeminiLiveTranscriber.name),
      ...stripUndefined(options),
      model: options.model,
    };
  }

  async open(p: {
    sessionId: SessionId;
    language: LanguageCode;
    glossary: Glossary;
    signal: AbortSignalLike;
  }): Promise<TranscriberStream> {
    const stream = new GeminiLiveStream(this.client, this.options, p);
    await stream.start();
    return stream;
  }
}

class GeminiLiveStream implements TranscriberStream {
  private readonly queue = new AsyncQueue<TranscriptSegment>();
  private session: GeminiLiveSession | null = null;
  private generation = 0;
  private reconnecting = false;
  private consecutiveFailures = 0;
  private closed = false;
  private closing: Promise<void> | null = null;
  private resumeHandle: string | undefined;

  private pendingAudio: AudioChunk[] = [];
  private pendingAudioMs = 0;
  private audioEndMs = 0;
  private lastFinalEndMs: number | null = null;
  private utteranceStartMs: number | null = null;

  private interimMode = false;
  private committed = '';
  private interim = '';
  private utteranceId: string | null = null;
  private lastEmitted = '';
  /** Words already emitted locally for an utterance the server has not finalized yet. */
  private forcedPrefixWords = 0;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onAbort = () => void this.close();

  constructor(
    private readonly client: GeminiLiveClient,
    private readonly options: ResolvedOptions,
    private readonly p: {
      sessionId: SessionId;
      language: LanguageCode;
      glossary: Glossary;
      signal: AbortSignalLike;
    },
  ) {}

  async start(): Promise<void> {
    if (this.p.signal.aborted) {
      await this.close();
      return;
    }
    this.p.signal.addEventListener('abort', this.onAbort, { once: true });
    try {
      await this.connect();
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  push(chunk: AudioChunk): void {
    if (this.closed) return;
    this.audioEndMs = Math.max(this.audioEndMs, chunk.offsetMs + chunk.durationMs);
    this.lastFinalEndMs ??= chunk.offsetMs;
    if (this.session && !this.reconnecting) this.send(chunk);
    else this.buffer(chunk);
    this.checkMaxLength();
  }

  segments(): AsyncIterable<TranscriptSegment> {
    return this.queue;
  }

  close(): Promise<void> {
    this.closing ??= this.shutdown();
    return this.closing;
  }

  // --- connection -------------------------------------------------------------------------

  private async connect(): Promise<void> {
    const generation = ++this.generation;
    const isCurrent = () => generation === this.generation && !this.closed;
    let established = false;
    let closedDuringSetup: { code?: number; reason?: string } | null = null;
    const session = await this.client.connect({
      model: this.options.model,
      config: this.buildConfig(),
      callbacks: {
        onmessage: (message) => {
          if (!isCurrent()) return;
          this.consecutiveFailures = 0; // the server is talking to us: connection is healthy
          this.onMessage(message);
        },
        onerror: (error) => {
          if (isCurrent()) this.options.logger.warn(`Gemini Live error: ${error.message}`);
        },
        onclose: (event) => {
          if (!isCurrent()) return;
          if (!established) {
            closedDuringSetup = event;
            return;
          }
          this.options.logger.warn(`Gemini Live connection closed (${describeClose(event)})`);
          this.reconnect();
        },
      },
    });
    if (closedDuringSetup) {
      safeClose(session);
      throw new Error(
        `Gemini Live connection closed during setup (${describeClose(closedDuringSetup)})`,
      );
    }
    if (!isCurrent()) {
      safeClose(session);
      return;
    }
    established = true;
    this.session = session;
    this.flushPendingAudio();
  }

  private buildConfig(): LiveConnectConfig {
    const vocabulary = vocabularyFrom(this.p.glossary);
    const config: LiveConnectConfig = {
      responseModalities: [Modality.TEXT],
      inputAudioTranscription: {
        languageCodes: [LIVE_LANGUAGE_CODES[this.p.language.value]],
        ...(vocabulary.length > 0 ? { customVocabulary: vocabulary } : {}),
      },
    };
    if (this.options.useSessionResumption) {
      config.sessionResumption = this.resumeHandle ? { handle: this.resumeHandle } : {};
    }
    return config;
  }

  private reconnect(): void {
    if (this.closed || this.reconnecting) return;
    this.reconnecting = true;
    const old = this.session;
    this.session = null;
    this.generation++; // ignore late callbacks from the old connection
    safeClose(old);
    // The new connection starts a fresh server-side utterance: nothing left to de-duplicate.
    this.finalize(false);
    this.forcedPrefixWords = 0;
    void this.reconnectLoop();
  }

  /**
   * Failures are counted until the server sends a message on a new connection, so a model that
   * accepts the socket and then always drops it still ends in `fail()` instead of looping.
   */
  private async reconnectLoop(): Promise<void> {
    while (!this.closed) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures > this.options.maxReconnectAttempts) {
        this.fail(new Error('Gemini Live connection lost: reconnect attempts exhausted'));
        return;
      }
      if (this.consecutiveFailures > 1) {
        await delay(this.options.reconnectDelayMs * (this.consecutiveFailures - 1));
        if (this.closed) return;
      }
      try {
        await this.connect();
        this.reconnecting = false;
        this.flushPendingAudio();
        return;
      } catch (error) {
        this.options.logger.warn(`Gemini Live reconnect failed: ${describe(error)}`);
      }
    }
  }

  private send(chunk: AudioChunk): void {
    try {
      this.session?.sendRealtimeInput({
        audio: { data: toBase64(chunk.data), mimeType: LIVE_AUDIO_MIME_TYPE },
      });
    } catch (error) {
      this.options.logger.warn(`Gemini Live send failed: ${describe(error)}`);
      this.buffer(chunk);
      this.reconnect();
    }
  }

  private buffer(chunk: AudioChunk): void {
    this.pendingAudio.push(chunk);
    this.pendingAudioMs += chunk.durationMs;
    while (this.pendingAudioMs > this.options.maxBufferedAudioMs && this.pendingAudio.length > 1) {
      const dropped = this.pendingAudio.shift();
      this.pendingAudioMs -= dropped?.durationMs ?? 0;
    }
  }

  private flushPendingAudio(): void {
    if (!this.session || this.reconnecting) return;
    const pending = this.pendingAudio;
    this.pendingAudio = [];
    this.pendingAudioMs = 0;
    for (const chunk of pending) this.send(chunk);
  }

  // --- transcription ----------------------------------------------------------------------

  private onMessage(message: GeminiLiveMessage): void {
    const update = message.sessionResumptionUpdate;
    if (update?.resumable && update.newHandle) this.resumeHandle = update.newHandle;

    const content = message.serverContent;
    if (content?.interimInputTranscription?.text !== undefined) {
      this.interimMode = true;
      this.interim = this.stripForcedPrefix(content.interimInputTranscription.text);
      this.onText();
    }
    if (content?.inputTranscription) {
      const text = content.inputTranscription.text ?? '';
      if (this.interimMode) {
        this.interim = '';
        this.committed = `${this.committed} ${this.stripForcedPrefix(text)}`;
        this.forcedPrefixWords = 0;
        this.finalize(false);
      } else {
        this.committed += text;
        this.onText();
        if (content.inputTranscription.finished) this.finalize(false);
      }
    }
    if (content?.turnComplete) this.finalize(false);

    if (message.goAway) {
      this.options.logger.log(`Gemini Live goAway (timeLeft=${message.goAway.timeLeft ?? '?'})`);
      this.reconnect();
    }
  }

  private currentText(): string {
    return normalizeText(`${this.committed} ${this.interim}`);
  }

  private onText(): void {
    const text = this.currentText();
    if (!text) return;
    this.resetSilenceTimer();
    if (text !== this.lastEmitted) {
      this.lastEmitted = text;
      this.emit(text, false);
    }
    this.checkMaxLength();
  }

  private checkMaxLength(): void {
    if (this.utteranceStartMs === null || !this.currentText()) return;
    if (this.audioEndMs - this.utteranceStartMs >= this.options.maxSegmentMs) this.finalize(true);
  }

  /**
   * @param local true when we cut the utterance ourselves (silence/max length/reconnect/close);
   * in interim mode the server may still send those words again, so remember how many to skip.
   */
  private finalize(local: boolean): void {
    this.clearSilenceTimer();
    const text = this.currentText();
    if (text) {
      this.emit(text, true);
      if (local && this.interimMode) this.forcedPrefixWords += countWords(text);
    }
    this.committed = '';
    this.interim = '';
    this.lastEmitted = '';
    this.utteranceId = null;
    this.utteranceStartMs = null;
    if (text) this.lastFinalEndMs = this.audioEndMs;
  }

  private stripForcedPrefix(text: string): string {
    if (this.forcedPrefixWords === 0) return text;
    return normalizeText(text).split(' ').slice(this.forcedPrefixWords).join(' ');
  }

  private emit(text: string, isFinal: boolean): void {
    this.utteranceId ??= this.options.ids.next();
    this.utteranceStartMs ??= Math.max(
      this.lastFinalEndMs ?? 0,
      this.audioEndMs - this.options.firstTextLookbackMs,
    );
    const start = this.utteranceStartMs;
    this.queue.push(
      TranscriptSegment.original(
        {
          id: this.utteranceId,
          sessionId: this.p.sessionId,
          language: this.p.language,
          text,
          range: TimeRange.of(start, Math.max(start, this.audioEndMs)),
          isFinal,
        },
        this.options.ids,
      ),
    );
  }

  private resetSilenceTimer(): void {
    this.clearSilenceTimer();
    const ms = this.interimMode ? this.options.interimSilenceMs : this.options.silenceMs;
    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = null;
      if (!this.closed) this.finalize(true);
    }, ms);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }

  // --- lifecycle --------------------------------------------------------------------------

  private async shutdown(): Promise<void> {
    if (!this.closed) this.finalize(true);
    this.teardown();
    this.queue.end();
    await Promise.resolve();
  }

  private fail(error: unknown): void {
    if (this.closed) return;
    this.finalize(true);
    this.teardown();
    this.queue.fail(error instanceof Error ? error : new Error(describe(error)));
    this.closing ??= Promise.resolve();
  }

  private teardown(): void {
    this.closed = true;
    this.clearSilenceTimer();
    this.generation++;
    safeClose(this.session);
    this.session = null;
    this.pendingAudio = [];
    this.pendingAudioMs = 0;
    this.p.signal.removeEventListener('abort', this.onAbort);
  }
}

function countWords(text: string): number {
  return text ? text.split(' ').length : 0;
}

function safeClose(session: GeminiLiveSession | null): void {
  try {
    session?.close();
  } catch {
    // already closed
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeClose(event: { code?: number; reason?: string }): string {
  return `code=${event.code ?? '?'} reason=${event.reason || '-'}`;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}
