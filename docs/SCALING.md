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

### Concurrent Session Limits

- **Gemini Live API:** ~10 concurrent sessions per project
- **Per-project rate limit:** ~1000 requests per minute (Text and Streaming combined)
- See current limits: https://ai.google.dev/gemini-api/docs/quota

### Streaming Token Quota

Gemini Live API has a monthly streaming quota (varies by plan).

- **Free tier:** 50,000 tokens/month (for all endpoints)
- **Paid tier:** 10M tokens/month (standard)

One hour of audio → ~30,000–50,000 tokens (depends on content density and language).

### Translation Cost Estimation

**Per-segment translation (Gemini 2.5 Flash):**

- Typical segment: 50–200 characters
- Average output: ~100 characters
- Cost: ~0.00001 per input token + 0.00001 per output token

**Formula for one-hour event:**

```
Assume:
  - 60 min audio
  - 1 segment per 3 sec (realistic for live speech)
  - English audio: 4 tokens/word, ~4 words/sentence, ~1 sentence per segment
  - Average segment: ~150 tokens input, ~150 tokens output

Segments = 60 * 60 / 3 = 1200 segments
Input tokens = 1200 * 150 = 180,000
Output tokens (per language) = 1200 * 150 = 180,000

For 2 target languages (EN → [ES, PT]):
  Total input tokens ≈ 180,000
  Total output tokens ≈ 360,000 (2 languages)

Cost (2.5 Flash pricing):
  Input: 180,000 * $0.0000075 = $1.35
  Output: 360,000 * $0.00003 = $10.80
  Total translation ≈ $12.15 per hour per pair
```

**Gemini Live (streaming transcription):**

- 1 hour audio = ~1M tokens
- Cost: ~$0.0075 per 1k tokens = **$7.50/hour**

**Total per hour (EN transcription + EN→ES + EN→PT):**

```
Live transcription: $7.50
Translation EN→ES: $6.08
Translation EN→PT: $6.08
Total ≈ $19.66/hour
```

See official pricing: https://ai.google.dev/gemini-api/docs/pricing

### Cost Reduction Strategies

1. **Chunked fallback:** Use `generateContent` every ~4–5 sec instead of Live API for pre-recorded content (cheaper, higher latency).
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

| Scale      | Sessions | Setup          | Bottleneck   | Cost (1 hr)                     |
| ---------- | -------- | -------------- | ------------ | ------------------------------- |
| Vertical   | ≤ 10–12  | 1 instance     | Gemini quota | $19.66                          |
| Horizontal | 50+      | Redis + 5× API | Gemini quota | $98+ (proportional to sessions) |

For Nerdearla 2026 (2 concurrent sessions, 2 hours), **Vertical on cloud instance (4 vCPU, 8 GB) is sufficient** with ~$40 total Gemini cost.
