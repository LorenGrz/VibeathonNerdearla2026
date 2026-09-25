# Architecture: Hexagonal Design for LiveSubs

## Overview

LiveSubs follows **hexagonal (ports and adapters) architecture** with a shared **domain model** consumed by both API and web frontend. This design isolates business logic from frameworks, simplifies testing, and enables multiple implementations of the same behavior.

```
┌─────────────────────────────────────────────────┐
│              Domain (@subs/domain)              │
│  Entities, VOs, Events, Ports, Contracts, DTOs │
└─────────────────────────────────────────────────┘
            ▲              ▲              ▲
            │              │              │
     ┌──────┴──────┬───────┴────┬────────┴─────┐
     │             │            │              │
   NestJS       Next.js      Tests         Tools
    (API)       (Web)      (Vitest)       (CLI)
```

## Domain Layer (`packages/domain/src`)

Pure TypeScript. No runtime dependencies. Exports:

- **Value Objects:** `LanguageCode`, `SessionId`, `TimeRange`, `GlossaryTerm`, `AudioSourceSpec`
- **Entities:** `Session` (aggregate root), `TranscriptSegment`, `Transcript`, `SessionMetrics`
- **Events:** `SessionStarted`, `SegmentTranscribed`, `SegmentTranslated`, `SessionFailed`, `SessionStopped`
- **Ports (interfaces):** `AudioSourcePort`, `TranscriberPort`, `TranslatorPort`, `SessionRepository`, `TranscriptRepository`, `EventPublisherPort`
- **Contracts (DTOs):** `SessionDto`, `CaptionDto`, `SessionMetricsDto` (serializable, shared with web)
- **Exporters:** `SrtExporter`, `VttExporter`, `TextExporter`

### State Machine

```
   ┌─────────┐
   │ idle    │
   └────┬────┘
        │ start()
   ┌────▼──────┐
   │ starting  │
   └────┬──────┘
        │ markLive()
   ┌────▼────┐         fail(reason)
   │ live    │◄────────────┬─────────┐
   └────┬────┘             │         │
        │ stop()      ┌─────▼──┐     │
        └──────┬──────► error  │◄────┘
               │       └───────┘
           ┌───▼────┐
           │stopped │
           └────────┘
```

All transitions validate invariants (e.g., can't stop from `idle`). Invalid transitions throw `InvalidSessionTransitionError`.

## Application Layer (`apps/api/src`)

NestJS modules implementing the hexagonal ports and orchestrating domain logic.

### Modules

```
apps/api/src/
├── main.ts                           # Startup
├── app.module.ts                     # Root module (imports all)
├── config/                           # Env parsing (Zod) + health
│   └── env.ts                        # TRANSCRIBER, TRANSLATOR, GEMINI_API_KEY, MAX_SESSIONS, etc.
├── ingest/                           # Audio source adapters
│   ├── ffmpeg-audio-source.ts        # File/URL/YouTube via ffmpeg + yt-dlp
│   ├── mic-audio-source.ts           # Browser WebSocket PCM input (optional T11)
│   └── samples.controller.ts         # GET /api/samples → list files
├── transcription/                    # Transcriber adapters
│   ├── gemini-live.transcriber.ts    # Implements TranscriberPort (Gemini 3.5 Live)
│   ├── gemini-chunked.transcriber.ts # Fallback (generateContent every ~4 s)
│   ├── mock.transcriber.ts           # Mock (always returns [MOCK])
│   ├── transcription.module.ts       # Factory & DI configuration
│   └── gemini.client.ts              # Shared Gemini API utilities
├── translation/                      # Translator adapters
│   ├── gemini.translator.ts          # Implements TranslatorPort (Gemini 2.5 Flash + glossary)
│   ├── mock.translator.ts            # Mock
│   └── translation.module.ts         # Factory & DI
├── persistence/                      # Repository adapters
│   ├── in-memory-session.repository.ts       # SessionRepository
│   ├── in-memory-transcript.repository.ts    # TranscriptRepository
│   └── persistence.module.ts         # DI configuration
├── orchestrator/                     # Domain orchestration
│   ├── session-orchestrator.ts       # SessionRunner: manages session concurrency, backoff, metrics
│   ├── session-pipeline.ts           # Audio → Transcriber → Translator → EventPublisher
│   └── orchestrator.module.ts        # DI
├── realtime/                         # WebSocket & event publishing
│   ├── captions.gateway.ts           # Socket.IO gateway (rooms per session:id:lang)
│   ├── admin.gateway.ts              # Admin namespace (metrics snapshots)
│   ├── realtime.module.ts            # DI
│   └── in-memory-event-publisher.ts  # Publishes domain events to Socket.IO
├── sessions/                         # REST API
│   ├── sessions.controller.ts        # CRUD: GET/POST/DELETE, start, stop, export
│   ├── sessions.service.ts           # Session orchestration logic
│   └── sessions.module.ts            # DI
└── shared/                           # Utilities
    ├── tokens.ts                     # Nest injection tokens (TRANSCRIBER, TRANSLATOR, etc.)
    ├── guards/                       # (Optional) CORS, auth
    └── filters/                      # Global error handling
```

### Data Flow: One Session

```
┌─────────────────────────────────────────────┐
│ SessionsController.start(id)                │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ SessionsService.start(id)                   │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ SessionOrchestrator.start(id)               │
│  - Load session from repo                   │
│  - Call session.start() → fires             │
│    SessionStarted event                     │
│  - Spawn SessionPipeline in background      │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ SessionPipeline (async background task)    │
│  1. Open audio source (AudioSourcePort)    │
│  2. Open transcriber stream (Transcriber)  │
│  3. Pump audio chunks                       │
│  4. For each final segment:                 │
│     a. Call translator (TranslatorPort)    │
│     b. Publish to EventPublisher (Socket.IO│
│        rooms per language)                  │
│     c. Append to TranscriptRepository      │
│  5. On error: call session.fail()           │
│  6. On abort: call session.stop()           │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ CaptionsGateway (Socket.IO)                 │
│  Emits 'caption' on room session:id:lang   │
│  to all connected clients                   │
└─────────────────────────────────────────────┘
```

### Dependency Injection (NestJS)

Ports are provided as tokens in `apps/api/src/shared/tokens.ts`:

```typescript
// apps/api/src/shared/tokens.ts
export const AUDIO_SOURCE = Symbol('AUDIO_SOURCE');
export const TRANSCRIBER = Symbol('TRANSCRIBER');
export const TRANSLATOR = Symbol('TRANSLATOR');
export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
export const TRANSCRIPT_REPOSITORY = Symbol('TRANSCRIPT_REPOSITORY');
export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');
export const SESSION_RUNNER = Symbol('SESSION_RUNNER');
```

Modules register implementations:

```typescript
// apps/api/src/transcription/transcription.module.ts
@Module({
  providers: [
    {
      provide: TRANSCRIBER,
      useFactory: async (env: EnvService) => {
        switch (env.TRANSCRIBER) {
          case 'live':
            return new GeminiLiveTranscriber(env.GEMINI_LIVE_MODEL, client);
          case 'chunked':
            return new GeminiChunkedTranscriber(env.GEMINI_TEXT_MODEL, client);
          case 'mock':
            return new MockTranscriber();
        }
      },
      inject: [EnvService],
    },
  ],
  exports: [TRANSCRIBER],
})
export class TranscriptionModule {}
```

Then inject into services:

```typescript
@Injectable()
export class SessionPipeline {
  constructor(
    @Inject(TRANSCRIBER) private transcriber: TranscriberPort,
    @Inject(TRANSLATOR) private translator: TranslatorPort,
  ) {}
}
```

## Adapter Layer

### Audio Sources (`ingest/`)

**Port:** `AudioSourcePort.open(spec, signal): AsyncIterable<AudioChunk>`

**Adapters:**

- **FFmpeg:** Reads files, URLs, or YouTube (via yt-dlp), decodes to PCM 16 kHz mono, yields 100 ms chunks
- **Microphone:** (T11) Receives binary chunks from browser WebSocket, validates format, yields
- **Mock:** (Tests) Generates synthetic audio

### Transcribers (`transcription/`)

**Port:** `TranscriberPort.open(props): Promise<TranscriberStream>`

**Adapters:**

- **Gemini Live:** Streams audio to `/google.ai.StreamGenerateContentRequest`, yields partial + final `TranscriptSegment`s
- **Gemini Chunked:** Batches audio into ~4 s windows, calls `generateContent`, parses and yields
- **Mock:** Returns deterministic segments `[MOCK]` for all inputs

### Translators (`translation/`)

**Port:** `TranslatorPort.translate(segment, target, glossary): Promise<TranscriptSegment>`

**Adapters:**

- **Gemini:** Sends segment text + glossary to `generateContent`, parses and returns translated `TranscriptSegment`
- **Mock:** Appends `[→ES]` suffix to text

### Repositories (`persistence/`)

**Ports:**

- `SessionRepository`: save, findById, findAll, delete
- `TranscriptRepository`: append, get (by sessionId)

**Adapters:**

- **In-Memory:** Maps in RAM; lost on restart
- (Future) **Redis:** Persistent, shared across instances

### Event Publisher (`realtime/`)

**Port:** `EventPublisherPort.publish(events): Promise<void>`

**Adapters:**

- **Socket.IO:** Broadcasts domain events to Socket.IO rooms

## Presentation Layer

### API (`apps/api/src/sessions/`, `realtime/`)

**REST** (`/api` prefix):

- `GET /sessions` → `SessionDto[]`
- `POST /sessions` → create with body `CreateSessionDto`
- `POST /sessions/{id}/start` → begin pipeline
- `POST /sessions/{id}/stop` → stop gracefully
- `DELETE /sessions/{id}` → remove session
- `GET /sessions/{id}/transcript?lang=es` → `CaptionDto[]` (finals only)
- `GET /sessions/{id}/export?lang=es&format=srt` → file download
- `GET /health` → `{ ok: true, transcriber: 'live'|'chunked'|'mock' }`

**WebSocket** (Socket.IO):

| Namespace   | Event               | Direction     | Payload                   |
| ----------- | ------------------- | ------------- | ------------------------- |
| `/captions` | `captions:join`     | Client→Server | `{ sessionId, language }` |
| `/captions` | `caption`           | Server→Client | `CaptionDto`              |
| `/captions` | `session:status`    | Server→Client | `{ id, status }`          |
| `/captions` | `captions:history`  | Server→Client | `CaptionDto[]` (last 20)  |
| `/admin`    | (snapshot every 1s) | Server→Client | `SessionDto[]`            |
| `/mic`      | `mic:chunk`         | Client→Server | `ArrayBuffer` (PCM)       |

### Web (`apps/web/src`)

**Routes:**

- `/` — Session listing (mock browser)
- `/s/[id]` — Audience captions view (with language selector)
- `/overlay/[id]` — OBS overlay (transparent, fixed position, real-time)
- `/admin` — Production panel (CRUD, metrics, export)
- `/admin/mic/[id]` — Microphone capture (T11, optional)

**Client Socket.IO:**

```typescript
const io = connectToNamespace('/captions');
io.emit('captions:join', { sessionId, language });
io.on('caption', (dto: CaptionDto) => {
  // Update UI with new caption
});
```

## Event Flow

### Domain Events

**Source:** Entity state transitions (`Session.start()`, `Session.markLive()`, transcriber yields segment, etc.)

**Types:**

```typescript
type DomainEvent =
  | SessionStarted
  | SessionLive
  | SegmentTranscribed
  | SegmentTranslated
  | SessionStopped
  | SessionFailed;
```

**Lifecycle:**

1. Entity emits event → stored in aggregate's event buffer
2. `session.pullEvents()` retrieves and clears buffer
3. `SessionPipeline` publishes to `EventPublisherPort`
4. `EventPublisher` broadcasts via Socket.IO
5. Web client receives via listener

### Example: "Audio arrives, gets transcribed, gets translated"

```
1. FfmpegAudioSource.open() → yields AudioChunk
   └─> SessionPipeline.pump(chunk)

2. TranscriberStream.push(chunk)
   └─> Gemini API processes
   └─> yields TranscriptSegment (partial or final)

3. If final:
   └─> TranslatorPort.translate(segment, targetLang, glossary)
   └─> yields TranscriptSegment (translated)
   └─> SessionPipeline.publishEvents([SegmentTranslated])
   └─> EventPublisher.publish()

4. InMemoryEventPublisher emits on Socket.IO room:
   └─> io.to('session:abc:es').emit('caption', captionDto)

5. Web client receives:
   └─> io.on('caption', (dto) => addCaption(dto))
   └─> UI updates with new caption
```

## Configuration

### Environment Variables

**API** (required in `.env`):

```env
PORT=4000
WEB_ORIGIN=http://localhost:3000
TRANSCRIBER=mock|live|chunked      # Which transcriber adapter to use
TRANSLATOR=mock|gemini             # Which translator adapter to use
GEMINI_API_KEY=sk-...              # Required for live/gemini modes
GEMINI_LIVE_MODEL=gemini-3.5-transcribe-live
GEMINI_TEXT_MODEL=gemini-2.5-flash
MAX_SESSIONS=12                    # Concurrency limit
SAMPLES_DIR=../../samples           # Where to find audio fixtures
```

**Web** (build-time + runtime):

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Dependency Injection Tokens

All ports are provided as `Symbol` tokens (defined in `apps/api/src/shared/tokens.ts`). Modules export them so consumers can inject:

```typescript
// In a service:
constructor(
  @Inject(TRANSCRIBER) transcriber: TranscriberPort,
  @Inject(TRANSLATOR) translator: TranslatorPort,
) {}
```

## Testing

### Unit Tests

Test individual adapters against the port interface:

```typescript
// apps/api/src/transcription/mock.transcriber.spec.ts
it('yields segments with [MOCK] text', async () => {
  const transcriber = new MockTranscriber();
  const stream = await transcriber.open({
    sessionId: SessionId.create(),
    language: LanguageCode.of('en'),
    glossary: Glossary.empty(),
    signal: new AbortController().signal,
  });

  // Push audio chunk
  stream.push(audioChunk);

  // Collect segments
  const segments: TranscriptSegment[] = [];
  for await (const seg of stream.segments()) {
    segments.push(seg);
  }

  expect(segments).toContainEqual(
    expect.objectContaining({ text: expect.stringMatching(/\[MOCK\]/) }),
  );
});
```

### E2E Tests

Test full flow via Supertest + Socket.IO client:

```typescript
// apps/api/src/sessions/sessions.controller.spec.ts (e2e)
it('streams mock captions to audience', async () => {
  // Create session via REST
  const { body: session } = await request(app.getHttpServer())
    .post('/api/sessions')
    .send(createSessionDto);

  // Start session
  await request(app.getHttpServer()).post(`/api/sessions/${session.id}/start`);

  // Connect Socket.IO client
  const socket = io('ws://localhost:4000/captions');
  socket.emit('captions:join', { sessionId: session.id, language: 'es' });

  // Listen for captions
  await new Promise((resolve) => {
    socket.on('caption', (dto: CaptionDto) => {
      expect(dto.text).toMatch(/\[MOCK\]/);
      resolve(null);
    });
  });
});
```

## Design Rationale

1. **Ports in domain, implementations in adapters:** Decouples business logic from frameworks. Easy to test, swap, and extend.
2. **In-memory repos for MVP:** Fast; sufficient for single-event use. Can upgrade to Redis without changing domain.
3. **Event-driven cascade:** Transcriber emits events → translator acts → publisher broadcasts. Loose coupling, easy to add new subscribers.
4. **Glossary in prompts:** Simple, no database required; ensures consistent terminology.
5. **Mock adapters:** Enable development and integration testing without Gemini API key or real audio.
6. **Session per pipeline:** Natural concurrency boundary. Metrics and error handling are per-session.

## Future Enhancements

1. **Distributed state:** Replace in-memory repos with Redis or PostgreSQL.
2. **Kafka for events:** Decouple captions from transcription for higher throughput.
3. **Multi-hop translation:** EN → [ES, PT, FR] via a translation graph (not just EN → N).
4. **Real-time glossary editing:** Admin panel to update glossary without restart.
5. **Metrics store:** Prometheus + Grafana for latency, throughput, error rates.
