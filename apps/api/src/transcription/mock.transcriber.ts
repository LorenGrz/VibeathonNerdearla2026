import {
  TimeRange,
  TranscriptSegment,
  randomIdGenerator,
  type AbortSignalLike,
  type AudioChunk,
  type Glossary,
  type IdGenerator,
  type LanguageCode,
  type LanguageCodeValue,
  type SessionId,
  type TranscriberPort,
  type TranscriberStream,
} from '@subs/domain';

/** Fixed script per language; the mock cycles through it regardless of the audio received. */
export const MOCK_SCRIPTS: Record<LanguageCodeValue, readonly string[]> = {
  en: [
    'Welcome everyone to this session about live captions',
    'Today we will stream audio from several stages at once',
    'Each stage gets its own transcription pipeline',
    'Translations are produced in parallel for every target language',
    'Thanks for joining and enjoy the rest of the conference',
  ],
  es: [
    'Bienvenidos a esta charla sobre subtítulos en vivo',
    'Hoy vamos a transmitir audio de varios escenarios a la vez',
    'Cada escenario tiene su propio pipeline de transcripción',
    'Las traducciones se generan en paralelo para cada idioma destino',
    'Gracias por venir y disfruten el resto de la conferencia',
  ],
  pt: [
    'Bem-vindos a esta palestra sobre legendas ao vivo',
    'Hoje vamos transmitir áudio de vários palcos ao mesmo tempo',
    'Cada palco tem o seu próprio pipeline de transcrição',
    'As traduções são geradas em paralelo para cada idioma de destino',
    'Obrigado por participar e aproveitem o resto da conferência',
  ],
};

export interface MockTranscriberOptions {
  /** Time per phrase (2 partials + 1 final, evenly spaced). Default 1500 ms. */
  intervalMs?: number;
  /** Segment id generator (also used by `translate()` on the produced segments). */
  ids?: IdGenerator;
}

const STEPS_PER_PHRASE = 3;

/**
 * `TRANSCRIBER=mock`. Not decorated on purpose: bind it with
 * `{ provide: TRANSCRIBER, useFactory: () => new MockTranscriber() }`.
 */
export class MockTranscriber implements TranscriberPort {
  private readonly intervalMs: number;
  private readonly ids: IdGenerator;

  constructor(options: MockTranscriberOptions = {}) {
    this.intervalMs = options.intervalMs ?? 1500;
    this.ids = options.ids ?? randomIdGenerator;
  }

  open(p: {
    sessionId: SessionId;
    language: LanguageCode;
    glossary: Glossary;
    signal: AbortSignalLike;
  }): Promise<TranscriberStream> {
    return Promise.resolve(
      new MockTranscriberStream(p.sessionId, p.language, p.signal, this.intervalMs, this.ids),
    );
  }
}

class MockTranscriberStream implements TranscriberStream {
  private readonly queue = new AsyncQueue<TranscriptSegment>();
  private readonly timer: ReturnType<typeof setInterval> | undefined;
  private readonly onAbort = (): void => {
    void this.close();
  };
  private step = 0;
  private currentId = '';
  private closed = false;

  constructor(
    private readonly sessionId: SessionId,
    private readonly language: LanguageCode,
    private readonly signal: AbortSignalLike,
    private readonly intervalMs: number,
    private readonly ids: IdGenerator,
  ) {
    if (signal.aborted) {
      this.closed = true;
      this.queue.end();
      return;
    }
    signal.addEventListener('abort', this.onAbort, { once: true });
    this.timer = setInterval(() => this.tick(), Math.max(1, intervalMs / STEPS_PER_PHRASE));
  }

  /** Audio is ignored: the mock emits its script on a timer. */
  push(_chunk: AudioChunk): void {}

  segments(): AsyncIterable<TranscriptSegment> {
    return this.queue;
  }

  /** Stops emitting; already queued segments are still delivered, then iteration ends. */
  close(): Promise<void> {
    if (!this.closed) {
      this.closed = true;
      if (this.timer) clearInterval(this.timer);
      this.signal.removeEventListener('abort', this.onAbort);
      this.queue.end();
    }
    return Promise.resolve();
  }

  private tick(): void {
    const phraseIndex = Math.floor(this.step / STEPS_PER_PHRASE);
    const stage = this.step % STEPS_PER_PHRASE;
    this.step += 1;

    const script = MOCK_SCRIPTS[this.language.value];
    const words = (script[phraseIndex % script.length] ?? '').split(' ');
    const isFinal = stage === STEPS_PER_PHRASE - 1;
    const count = isFinal
      ? words.length
      : Math.max(1, Math.ceil((words.length * (stage + 1)) / STEPS_PER_PHRASE));
    // Partials and the final of a phrase share an id so clients can update in place.
    if (stage === 0) this.currentId = this.ids.next();

    const startMs = phraseIndex * this.intervalMs;
    const endMs = startMs + Math.round((this.intervalMs * (stage + 1)) / STEPS_PER_PHRASE);
    this.queue.put(
      TranscriptSegment.original(
        {
          id: this.currentId,
          sessionId: this.sessionId,
          language: this.language,
          text: words.slice(0, count).join(' '),
          range: TimeRange.of(startMs, endMs),
          isFinal,
        },
        this.ids,
      ),
    );
  }
}

/** Single-consumer push queue exposed as an AsyncIterable. */
class AsyncQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private waiters: ((result: IteratorResult<T>) => void)[] = [];
  private ended = false;

  put(item: T): void {
    if (this.ended) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter({ value: item, done: false });
    else this.items.push(item);
  }

  end(): void {
    this.ended = true;
    for (const waiter of this.waiters) waiter({ value: undefined, done: true });
    this.waiters = [];
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.items.length > 0) {
          return Promise.resolve({ value: this.items.shift() as T, done: false });
        }
        if (this.ended) return Promise.resolve({ value: undefined, done: true });
        return new Promise<IteratorResult<T>>((resolve) => this.waiters.push(resolve));
      },
      return: () => {
        this.end();
        return Promise.resolve({ value: undefined, done: true });
      },
    };
  }
}
