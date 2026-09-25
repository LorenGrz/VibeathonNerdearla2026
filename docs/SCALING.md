# Scaling LiveSubs

## Vertical Scaling (Single Instance)

Each NestJS process runs up to `MAX_SESSIONS` concurrent session pipelines. The hard limit is Gemini's concurrent session quota (typically 10 live sessions per project).

**Configuration:**

```env
MAX_SESSIONS=12  # Per process; limited by Gemini Live quota in practice
```

**Process bottlenecks:**

- Memory: ~20–40 MB per session (buffering + in-memory repos)
- CPU: Negligible for transcription (Gemini is remote); translation is ~50 ms per segment
- Network: ~0.5 Mbps per session audio stream + 10 Kbps captions uplink

**Example:** A 4-vCPU, 8 GB Node.js instance can comfortably handle 12 concurrent sessions with room for application overhead.

## Horizontal Scaling

Multiple API instances require:

1. **Session assignment:** External coordinator (e.g., Redis) tracks which instance owns which session.
2. **Shared event bus:** Socket.IO Redis adapter broadcasts captions to all web clients globally.
3. **Shared persistence:** Replace in-memory repos with Redis or database (optional for MVP).

### Architecture

```
┌──────────────────────────────────────┐
│  Load Balancer (nginx, ALB, etc.)    │
└──────────────────────────────────────┘
         │         │         │
    ┌────┴────┬────┴────┬────┴────┐
    │          │          │         │
  ┌─┴──┐    ┌─┴──┐    ┌─┴──┐      │
  │API1│    │API2│    │API3│ ...  │
  └────┘    └────┘    └────┘      │
    │        │         │          │
    └────┬───┴────┬────┘          │
         │        │               │
    ┌────┴────────┴──────┐        │
    │   Redis             │        │
    │ - Socket.IO adapter │ ◄──────┘
    │ - Session locks     │
    │ - Transcripts (opt.)│
    └────────────────────┘

    ┌─────────────────────┐
    │  Next.js (stateless)│  Deployed on CDN or multi-region
    └─────────────────────┘
```

### Redis Adapter Setup (for multi-instance)

Add to `apps/api/src/realtime/gateway.module.ts`:

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

@Module({
  providers: [
    {
      provide: 'SOCKET_IO_ADAPTER',
      useFactory: async () => {
        const pubClient = createClient({ url: process.env.REDIS_URL });
        await pubClient.connect();
        const subClient = pubClient.duplicate();
        return createAdapter(pubClient, subClient);
      },
    },
  ],
})
export class RealtimeModule {}
```

Then configure Gateway to use it:

```typescript
gateway.io.adapter(redisAdapter);
```

**Environment:** `REDIS_URL=redis://localhost:6379`

## Gemini API Quotas & Limits

The real ceiling is not CPU but the Gemini quota of your project: concurrent Live sessions,
requests per minute and tokens per minute. They depend on your tier and change over time, so
check them before the event instead of trusting a number in this file:

- Rate limits per tier: https://ai.google.dev/gemini-api/docs/rate-limits
- A Live transcription connection lasts about 10 minutes; the transcriber reconnects
  transparently (see `apps/api/src/transcription/gemini-live.transcriber.ts`).

Rule of thumb: **1 stage = 1 Live connection** + 1 `generateContent` call per final segment
and target language.

## Cost Estimation

Prices change; take them from https://ai.google.dev/gemini-api/docs/pricing and plug them
into this formula:

```
per stage-hour =
    live_audio_price_per_hour                       # transcription (Live API, audio input)
  + S * L * (T_in * price_in + T_out * price_out)   # translation (text model)

S     = final segments per hour        (~1 every 3-5 s of speech -> 700-1200)
L     = target languages for that stage
T_in  = input tokens per call          (prompt + glossary + 2 context sentences + segment)
T_out = output tokens per call         (the translated sentence)

event total = sum over stages of (per stage-hour * hours streamed)
```

Levers that lower cost:

1. **Chunked fallback:** Use `generateContent` every ~4–5 sec instead of the Live API (higher latency; compare both prices before choosing).
2. **Language filters:** Only translate to requested languages; don't translate all pairs.
3. **Segment batching:** Batch small segments before translation (reduces API calls).
4. **Glossary caching:** Cache translation results for known terms (glossary).
5. **Regional endpoints:** Use closest regional inference endpoint if available.

## Web Frontend Scaling

The Next.js frontend is **stateless**:

- No sessions stored in the app
- Client-side Socket.IO subscriptions to session rooms
- All state lives on API (or backend persistence)

### Deployment

```yaml
# Deploy to CDN (Vercel, Netlify, Cloudflare Pages)
# Or behind a load balancer with multiple instances:

- Environment: NEXT_PUBLIC_API_URL pointing to API load balancer
- Cache: Static pages (/) cached at CDN edge
- Realtime: Socket.IO connects directly to API (sticky sessions not needed due to Redis adapter)
```

## Monitoring & Scaling Triggers

### Metrics to Watch

- **API latency:** p50 < 100 ms, p95 < 500 ms
- **Session pipeline duration:** audio-end to caption-published < 3 s (including Gemini latency)
- **Memory per session:** ~30 MB steady-state
- **Socket.IO room fan-out:** < 50 ms for 1000 subscribers

### When to Scale Horizontally

- `MAX_SESSIONS` limit reached and demand > 12 concurrent sessions
- Gemini Live quota exhausted (contact Google for increase or use chunked fallback)
- Redis adapter latency > 100 ms (scale Redis)
- API error rate > 0.1%

## Disaster Recovery

1. **Session state:** Keep in-memory only (MVP). For production, persist to Redis or database.
2. **Transcript backup:** Export SRT/VTT after each session.
3. **Gemini rate limit:** Gracefully degrade to chunked ASR or mock transcriber.
4. **WebSocket reconnection:** Client auto-reconnects on disconnect with exponential backoff.

## Summary

| Scale      | Sessions                      | Setup                   | Bottleneck          |
| ---------- | ----------------------------- | ----------------------- | ------------------- |
| Vertical   | up to `MAX_SESSIONS` per node | 1 API instance          | Gemini quota        |
| Horizontal | 30+ stages                    | N API instances + Redis | Gemini quota / tier |

For a Nerdearla-sized event (30+ English sessions, several in parallel), plan one API instance
per ~`MAX_SESSIONS` stages, share Socket.IO through the Redis adapter, and raise the Gemini
tier ahead of time.
