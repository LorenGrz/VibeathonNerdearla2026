# T3 — Orquestador de sesiones concurrentes
**Dificultad:** Difícil · **Agente:** `reasoner` (opus) · **Rama:** `feature/orchestrator` · **Depende de:** T1

## Objetivo
El corazón de la escala: correr N sesiones en paralelo en un proceso, aisladas entre sí.

## Piezas
- `SessionPipeline` (una por sesión): `AudioSourcePort.open()` → `TranscriberStream.push()`; consume `segments()`; parciales se publican directo; finales se persisten, se publican y se traducen **en paralelo** a cada target (`Promise.allSettled`, error de traducción no mata la sesión). Registra métricas (chunks, bytes, latencia = now − (sessionStart + range.endMs), errores).
- `SessionOrchestrator` (servicio Nest): `start(id)`, `stop(id)`, `isRunning(id)`; mapa `id → { pipeline, AbortController }`; respeta `MAX_SESSIONS` (error 409 si se excede); reintento con backoff exponencial (1s, 2s, 4s… máx 30s, 5 intentos) si falla el transcriptor o la fuente; al agotar → `session.fail()`. Tras cada cambio de estado: `repo.save` + `publisher.publish(session.pullEvents())`. `onModuleDestroy` detiene todo.
- `MockTranscriber` (`TRANSCRIBER=mock`): emite frases de un guion fijo por idioma cada ~1.5 s (2 parciales + 1 final), sin importar el audio. Permite demo y tests sin key.
- `InMemorySessionRepository`, `InMemoryTranscriptRepository`.

## Archivos
`apps/api/src/orchestrator/**`, `apps/api/src/transcription/mock.transcriber.ts`, `apps/api/src/persistence/in-memory-*.repository.ts` (+ `persistence.module.ts`).

## Aceptación
```
pnpm --filter @subs/api test -- orchestrator && pnpm --filter @subs/api typecheck
```
El spec debe arrancar **2 sesiones Mock concurrentes** (fuente fake) y verificar: segmentos de cada una con su `sessionId`, sin mezcla; stop de una no afecta la otra; exceder `MAX_SESSIONS` falla; fallo transitorio → reintento → live.
