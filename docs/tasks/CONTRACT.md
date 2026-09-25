# Contrato compartido (`@subs/domain`)

Fuente de verdad para las tareas en paralelo. T1 lo implementa tal cual; el resto programa contra él. Si hace falta cambiarlo, se para y se consulta a un `reasoner`.

## Layout
```
packages/domain/src/
  index.ts                 # re-exporta todo
  shared/                  # Result, DomainError, Clock, IdGenerator
  language/                # LanguageCode
  session/                 # Session, SessionId, SessionStatus, AudioSourceSpec, SessionMetrics
  transcript/              # TranscriptSegment, Transcript, TimeRange
  glossary/                # Glossary, GlossaryTerm
  events/                  # DomainEvent + eventos concretos
  ports/                   # interfaces de puertos
  contracts/               # DTOs REST + eventos WS (serializables, sin clases)
  export/                  # SrtExporter, VttExporter, TextExporter (T6)
```
Sin dependencias runtime. ESM + tipos. Build con `tsc` a `dist/`; `package.json` con `exports`.

## Value objects
```ts
export const SUPPORTED_LANGUAGES = ['en', 'es', 'pt'] as const;
export type LanguageCodeValue = (typeof SUPPORTED_LANGUAGES)[number];
export class LanguageCode {            // inmutable, equals(), toString()
  static of(value: string): LanguageCode; // lanza InvalidLanguageError
  readonly value: LanguageCodeValue;
}
export class SessionId { static create(): SessionId; static of(v: string): SessionId; readonly value: string; }
export class TimeRange { static of(startMs: number, endMs: number): TimeRange; readonly startMs: number; readonly endMs: number; durationMs(): number; }
export type AudioSourceSpec =
  | { kind: 'file'; path: string }       // relativo a samples/ o absoluto
  | { kind: 'url'; url: string }         // HLS/RTMP/Icecast/YouTube (yt-dlp)
  | { kind: 'mic' };                      // PCM por WS desde el browser
export class GlossaryTerm { constructor(readonly source: string, readonly translations: Partial<Record<LanguageCodeValue, string>>, readonly note?: string) }
export class Glossary { constructor(terms: GlossaryTerm[]); toPromptSection(target: LanguageCode): string; terms(): readonly GlossaryTerm[]; }
```

## Entidades
```ts
export type SessionStatus = 'idle' | 'starting' | 'live' | 'stopped' | 'error';

export class Session {                 // aggregate root
  static create(props: { title: string; stage: string; sourceLanguage: LanguageCode; targetLanguages: LanguageCode[]; source: AudioSourceSpec; glossary?: Glossary }): Session;
  readonly id: SessionId;
  get status(): SessionStatus;
  get metrics(): SessionMetrics;
  start(): void;                       // idle|stopped|error -> starting
  markLive(): void;                    // starting -> live
  fail(reason: string): void;          // * -> error
  stop(): void;                        // starting|live -> stopped
  languages(): LanguageCode[];         // source + targets, sin duplicados
  pullEvents(): DomainEvent[];         // devuelve y limpia eventos pendientes
  toSnapshot(): SessionDto;            // para contratos
}
// Transiciones inválidas lanzan InvalidSessionTransitionError.

export class SessionMetrics {
  recordChunk(bytes: number): void;
  recordLatency(ms: number): void;     // audio-end -> segmento publicado
  recordError(message: string): void;
  snapshot(): SessionMetricsDto;       // p50/p95 sobre ventana de 100
}

export type SegmentKind = 'original' | 'translation';
export class TranscriptSegment {
  static original(p: { sessionId: SessionId; language: LanguageCode; text: string; range: TimeRange; isFinal: boolean }): TranscriptSegment;
  translate(target: LanguageCode, text: string): TranscriptSegment; // kind=translation, sourceSegmentId=this.id, mismo range, isFinal=true
  readonly id: string; readonly sessionId: SessionId; readonly language: LanguageCode;
  readonly text: string; readonly range: TimeRange; readonly isFinal: boolean;
  readonly kind: SegmentKind; readonly sourceSegmentId?: string;
  toDto(): CaptionDto;
}

export class Transcript {             // por sesión
  constructor(sessionId: SessionId);
  add(segment: TranscriptSegment): void;          // solo finales se persisten; parciales se ignoran
  forLanguage(lang: LanguageCode): readonly TranscriptSegment[]; // ordenados por startMs
}
```

## Eventos de dominio
```ts
export interface DomainEvent { readonly type: string; readonly occurredAt: Date; readonly sessionId: string }
// SessionStarted, SessionLive, SessionStopped, SessionFailed{reason}, SegmentTranscribed{segment}, SegmentTranslated{segment}
```

## Puertos
```ts
export interface AudioChunk { data: Uint8Array; offsetMs: number; durationMs: number } // PCM s16le 16kHz mono
export const AUDIO_FORMAT = { sampleRate: 16000, channels: 1, encoding: 's16le' } as const;

export interface AudioSourcePort {
  open(spec: AudioSourceSpec, signal: AbortSignal): AsyncIterable<AudioChunk>;
}

export interface TranscriberStream {
  push(chunk: AudioChunk): void;
  segments(): AsyncIterable<TranscriptSegment>;   // parciales y finales
  close(): Promise<void>;
}
export interface TranscriberPort {
  open(p: { sessionId: SessionId; language: LanguageCode; glossary: Glossary; signal: AbortSignal }): Promise<TranscriberStream>;
}

export interface TranslatorPort {
  translate(segment: TranscriptSegment, target: LanguageCode, glossary: Glossary): Promise<TranscriptSegment>;
}

export interface SessionRepository { save(s: Session): Promise<void>; findById(id: SessionId): Promise<Session | null>; findAll(): Promise<Session[]>; delete(id: SessionId): Promise<void> }
export interface TranscriptRepository { append(segment: TranscriptSegment): Promise<void>; get(sessionId: SessionId): Promise<Transcript> }
export interface EventPublisherPort { publish(events: DomainEvent[]): Promise<void> }
```
Tokens de inyección Nest (en `apps/api/src/shared/tokens.ts`, T0): `AUDIO_SOURCE`, `TRANSCRIBER`, `TRANSLATOR`, `SESSION_REPOSITORY`, `TRANSCRIPT_REPOSITORY`, `EVENT_PUBLISHER`, `SESSION_RUNNER` (`interface SessionRunner { start(id: SessionId): Promise<void>; stop(id: SessionId): Promise<void> }`, implementado por `SessionOrchestrator`).

## Contratos (DTOs planos, compartidos con web)
```ts
export interface SessionDto { id: string; title: string; stage: string; sourceLanguage: LanguageCodeValue; targetLanguages: LanguageCodeValue[]; source: AudioSourceSpec; status: SessionStatus; metrics: SessionMetricsDto }
export interface SessionMetricsDto { chunksIn: number; bytesIn: number; latencyP50Ms: number | null; latencyP95Ms: number | null; errors: number; lastError: string | null; lastActivityAt: string | null }
export interface CaptionDto { id: string; sessionId: string; language: LanguageCodeValue; text: string; startMs: number; endMs: number; isFinal: boolean; kind: SegmentKind; sourceSegmentId?: string }
export interface CreateSessionDto { title: string; stage: string; sourceLanguage: LanguageCodeValue; targetLanguages: LanguageCodeValue[]; source: AudioSourceSpec; glossary?: { source: string; translations: Partial<Record<LanguageCodeValue, string>> }[] }
export type ExportFormat = 'srt' | 'vtt' | 'txt';
```

### REST (`apps/api`, prefijo `/api`)
| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/sessions` | `SessionDto[]` |
| POST | `/sessions` | `SessionDto` (body `CreateSessionDto`) |
| GET | `/sessions/:id` | `SessionDto` |
| POST | `/sessions/:id/start` · `/stop` | `SessionDto` |
| DELETE | `/sessions/:id` | 204 |
| GET | `/sessions/:id/transcript?lang=es` | `CaptionDto[]` (finales) |
| GET | `/sessions/:id/export?lang=es&format=srt` | archivo con `Content-Disposition` |
| GET | `/samples` | `string[]` (archivos en `samples/`) |
| GET | `/health` | `{ ok: true, transcriber: 'live'\|'chunked'\|'mock' }` |
Errores: `{ statusCode, error, message }` (default Nest).

### WebSocket (Socket.IO)
```ts
export const WS_NAMESPACE_CAPTIONS = '/captions';
export const WS_NAMESPACE_ADMIN = '/admin';
export const WS_NAMESPACE_MIC = '/mic';
export interface CaptionsClientEvents { 'captions:join': { sessionId: string; language: LanguageCodeValue }; 'captions:leave': { sessionId: string; language: LanguageCodeValue } }
export interface CaptionsServerEvents { 'caption': CaptionDto; 'session:status': Pick<SessionDto, 'id' | 'status'>; 'captions:history': CaptionDto[] } // history = últimos 20 al unirse
export interface AdminServerEvents { 'sessions:snapshot': SessionDto[] } // cada 1 s
export interface MicClientEvents { 'mic:start': { sessionId: string }; 'mic:chunk': ArrayBuffer; 'mic:stop': { sessionId: string } }
export const captionRoom = (sessionId: string, lang: LanguageCodeValue) => `session:${sessionId}:${lang}`;
```

## Env (`apps/api/.env.example`)
```
PORT=4000
WEB_ORIGIN=http://localhost:3000
TRANSCRIBER=mock            # live | chunked | mock
TRANSLATOR=mock             # gemini | mock
GEMINI_API_KEY=
GEMINI_LIVE_MODEL=gemini-3.5-transcribe-live     # verificado 2026-09-25 (el preview 2.5 fue dado de baja)
GEMINI_TEXT_MODEL=gemini-2.5-flash                # verificar el id vigente
MAX_SESSIONS=12
SAMPLES_DIR=../../samples
```
Web: `NEXT_PUBLIC_API_URL=http://localhost:4000`.

## Notas de implementación de T1 (vinculantes para la Ola 1)
- Los puertos reciben `AbortSignalLike` (subconjunto estructural de `AbortSignal`); los adapters pueden tipar el parámetro como `AbortSignal` y pasar un `AbortController().signal` real.
- `SessionRunner` vive en `@subs/domain` (ports); el token `SESSION_RUNNER` está en `apps/api/src/shared/tokens.ts`.
- Inyección determinista: `Session.create(props, { clock, ids })`, `SessionId.create(ids)`, `TranscriptSegment.original(p, ids)`, `new SessionMetrics(clock)`. Tests: `fixedClock(date)`, `sequentialIdGenerator('seg')`.
- `Session` expone además `title`, `stage`, `sourceLanguage`, `targetLanguages`, `source`, `glossary` (default `Glossary.empty()`), `createdAt`, `failureReason`. `fail()` es válido desde cualquier estado.
- Los eventos de segmento (`SegmentTranscribed`, `SegmentTranslated`) los crea el orquestador, no `Session`. Tipos: `session.started|live|stopped|failed`, `segment.transcribed|translated` (también `Clase.TYPE`).
- `Glossary.fromDto(dto.glossary)`, `Glossary.empty()`; `Transcript.all()`; errores: `DomainError` (`code`), `InvalidLanguageError`, `InvalidSessionTransitionError`, `InvalidArgumentError`. No hay `NotFound` en el dominio: lo modela la capa de aplicación de api.
