# Plan — Subtítulos en vivo abiertos para Nerdearla (Vibeathon 2026)

## Contexto

Nerdearla necesita transcripción simultánea abierta y escalable: audio en vivo de N escenarios → subtítulos en tiempo real en el idioma original + traducción EN→ES (bonus ES→EN), vista web para la audiencia, al menos 2 sesiones en paralelo, licencia OSI y un README desplegable. El repo `LorenGrz/VibeathonNerdearla2026` existe pero **está vacío** (sin rama por defecto). La deadline es **hoy (2026-09-25)**, así que el plan prioriza un MVP funcionando con un transcriptor Mock desde el minuto 1 y agrega Gemini por encima.

Decisiones tomadas con Loren:

- **Monorepo pnpm**: NestJS (API + WebSockets) + Next.js (App Router), TypeScript estricto.
- **Un dominio compartido OOP**: `packages/domain` en TS puro (entidades, value objects, eventos, puertos), usado por Nest y Next. Nest = hexagonal liviano (puertos/adaptadores).
- **Motor**: Gemini Live API para transcripción en streaming; traducción por segmento con Gemini Flash (texto) + glosario; adapter _chunked_ (`generateContent` cada ~4 s) como fallback; **Mock** para correr sin API key (tests, CI, jurados).
- **Persistencia**: repositorios in-memory detrás de un puerto; export SRT/VTT/TXT.
- Licencia **MIT**. Tests: Vitest en todos los paquetes (Nest 12 ya lo trae por defecto).

Toolchain local verificada: node 26, pnpm 12, ffmpeg, yt-dlp, docker.

## Arquitectura

```
apps/
  api/   NestJS  → ingesta (ffmpeg / mic WS) → transcriber → translator → Socket.IO
  web/   Next.js → audiencia, overlay OBS, panel de producción
packages/
  domain/  entidades + VOs + eventos + puertos + contratos WS + exporters (sin deps)
samples/   clips de audio de prueba (en/es) + scripts/fetch-samples.sh (yt-dlp)
docs/      SCALING.md, ARCHITECTURE.md
```

Flujo por sesión (`SessionPipeline`): `AudioSourcePort` (PCM 16 kHz mono s16le) → `TranscriberPort` (segmentos parciales/finales en idioma original) → por cada segmento final `TranslatorPort` a cada `targetLanguage` → `EventPublisherPort` (Socket.IO rooms `session:{id}:{lang}`) + `TranscriptRepository`.

### `packages/domain` (el corazón)

- **Value objects**: `LanguageCode` (`en|es|pt`), `SessionId`, `TimeRange`, `AudioSourceSpec` (`file|url|mic`), `GlossaryTerm`.
- **Entidades**: `Session` (aggregate root: `start()`, `markLive()`, `fail(err)`, `stop()`, invariantes de estado `idle→starting→live→stopped|error`, registra domain events), `TranscriptSegment` (original|translation, `isFinal`, `sourceSegmentId`), `Transcript` (segmentos por idioma), `Glossary`, `SessionMetrics` (latencia p50/p95, chunks, errores, lastActivity).
- **Eventos**: `SessionStarted`, `SegmentTranscribed`, `SegmentTranslated`, `SessionFailed`, `SessionStopped`.
- **Puertos**: `AudioSourcePort`, `TranscriberPort`, `TranslatorPort`, `SessionRepository`, `TranscriptRepository`, `EventPublisherPort`.
- **Contratos** WS/REST (tipos compartidos con web) + **exporters** `SrtExporter`, `VttExporter`, `TextExporter`.

### `apps/api` (Nest)

Módulos: `config` (zod env: `GEMINI_API_KEY`, `TRANSCRIBER=live|chunked|mock`, `MAX_SESSIONS`), `sessions` (REST CRUD + start/stop + export), `ingest` (`FfmpegAudioSource` file/URL/YouTube vía yt-dlp; `MicAudioSource` por WS binario), `transcription` (`GeminiLive`, `GeminiChunked`, `Mock` + factory), `translation` (`GeminiTranslator`, `MockTranslator`), `realtime` (gateway `/captions` + `/admin`), `orchestrator` (`SessionOrchestrator` con límite de concurrencia, reconexión con backoff y métricas).

### `apps/web` (Next)

- `/` lista de sesiones · `/s/[id]` audiencia (selector de idioma, autoscroll, tamaño de fuente, alto contraste) · `/overlay/[id]?lang=es` fondo transparente para OBS/vMix · `/admin` panel de producción (crear/iniciar/detener, fuente, estado, latencia, errores, export) · `/admin/mic/[id]` captura de micrófono (AudioWorklet → PCM → WS).

## Tareas por dificultad y agente

Regla: cada tarea tiene un **comando de aceptación**; las de la misma ola corren en paralelo con `isolation: "worktree"`; Mock primero para que todo sea verificable sin API key.

### Ola 0 — base (secuencial, inline, opus) · bloquea todo

| #   | Tarea                                                                                                                                                                                                                                                                           | Aceptación                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| T0  | Clonar repo, rama `feature/scaffold`, `.gitignore` (gate de CLAUDE.md), `pnpm-workspace`, `tsconfig.base`, eslint + prettier, LICENSE MIT, `nest new apps/api`, `create-next-app apps/web`, `packages/domain`, scripts raíz `dev/test/lint/format/typecheck`, CI GitHub Actions | `pnpm install && pnpm lint && pnpm typecheck && pnpm test` |
| T1  | **Dominio + puertos + contratos** (reasoner): entidades/VOs/eventos/puertos/tipos WS                                                                                                                                                                                            | `pnpm --filter @subs/domain test && pnpm typecheck`        |

### Ola 1 — en paralelo (worktrees)

| #   | Dif.    | Agente          | Tarea                                                                                                                                 | Aceptación                                                   |
| --- | ------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| T2  | Difícil | reasoner (opus) | `GeminiLiveTranscriber` (sesión Live, input transcription, reconexión cada ~10 min por límite de sesión) + `GeminiChunkedTranscriber` | tests Vitest con cliente fake; smoke manual con key          |
| T3  | Difícil | reasoner (opus) | `SessionOrchestrator` + `SessionPipeline` + `MockTranscriber`, concurrencia, backoff, métricas                                        | test: 2 sesiones Mock concurrentes emiten segmentos aislados |
| T4  | Media   | worker (sonnet) | `FfmpegAudioSource` (file/URL/yt-dlp → PCM chunks) + `scripts/fetch-samples.sh` + `samples/`                                          | test con `samples/*.mp3` produce chunks de 100 ms            |
| T5  | Media   | worker (sonnet) | `GeminiTranslator` + `MockTranslator` + glosario en prompt (Nerdearla, Kubernetes…)                                                   | Vitest con cliente fake                                      |
| T6  | Fácil   | worker (haiku)  | Exporters SRT/VTT/TXT en domain + unit tests                                                                                          | `pnpm --filter @subs/domain test`                            |
| T7  | Media   | worker (sonnet) | Gateway Socket.IO (rooms por sesión/idioma) + REST sessions + `GET /sessions/:id/export?format&lang`                                  | e2e Vitest (supertest + socket.io-client)                    |
| T8  | Media   | worker (sonnet) | Web audiencia `/`, `/s/[id]`, `/overlay/[id]` con socket.io-client                                                                    | `pnpm --filter web lint typecheck test build`                |
| T9  | Media   | worker (sonnet) | Web `/admin`: crear/iniciar/detener, métricas, links de export                                                                        | ídem T8                                                      |
| T10 | Fácil   | worker (haiku)  | README (setup, credenciales, Mock mode), `docs/SCALING.md`, docker-compose + Dockerfiles                                              | `docker compose config`                                      |

Dependencias: T2–T7 solo dependen de T1; T8–T9 dependen de contratos (T1), no de T7 (usar Mock server del contrato). T10 al final de la ola.

### Ola 2 — integración (inline, opus)

- Wiring completo, `TRANSCRIBER=mock` → 2 sesiones simultáneas visibles en web; luego `live` con clip real de Nerdearla EN y ES.
- `/admin/mic/[id]` (T11, difícil, reasoner) si hay tiempo.

### Ola 3 — opcionales (según tiempo)

Portugués (Fácil), ES→EN (Fácil, ya soportado por targetLanguages), glosario editable desde admin (Media), redis adapter para Socket.IO multi-instancia (Media).

## Escalado (para README/`docs/SCALING.md`)

Cada sesión es un `SessionPipeline` independiente (1 conexión Live por escenario). Escala vertical: `MAX_SESSIONS` por proceso. Horizontal: N instancias de api, asignación de sesiones por instancia + `@socket.io/redis-adapter` para fan-out a la audiencia; web stateless detrás de CDN. Límite real = cuota de sesiones concurrentes de Gemini Live por proyecto.

## Verificación end-to-end

1. `pnpm install && pnpm lint && pnpm typecheck && pnpm test` en raíz.
2. `TRANSCRIBER=mock pnpm dev` → crear 2 sesiones en `/admin` con `samples/en-*.mp3` y `samples/es-*.mp3` → abrir `/s/{id}` en dos pestañas con `es` y `en`: subtítulos independientes.
3. `TRANSCRIBER=live GEMINI_API_KEY=… pnpm dev` con un clip EN de Nerdearla → original + ES en < ~3 s; descargar SRT/VTT.
4. `/overlay/{id}?lang=en` como Browser Source en OBS para grabar el demo con subtítulos EN generados por el proyecto.
5. Git: flujo de CLAUDE.md (rama `feature/*`, `--no-ff` a main). Como el repo está vacío, el primer commit inicializa `main`.

> Detalle ejecutable de cada tarea (prompts por agente, olas y ownership de archivos): [`tasks/README.md`](tasks/README.md). T10 (docs/docker) se movió a la Ola 2 porque documenta lo que ya está integrado.
