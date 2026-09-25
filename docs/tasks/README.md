# Tablero de tareas — LiveSubs (Vibeathon Nerdearla 2026)

Cada archivo `Txx-*.md` es un **prompt autocontenido** para un agente: objetivo, archivos, contrato y comando de aceptación. Plan general en [`../PLAN.md`](../PLAN.md). Contrato compartido en [`CONTRACT.md`](CONTRACT.md) — **ningún agente lo cambia sin pasar por un reasoner**.

## Reglas para correr en paralelo
1. Una ola arranca cuando la anterior está mergeada en `main`.
2. Cada agente trabaja en su propio worktree (`isolation: "worktree"`) y en su rama `feature/<id>-<slug>`.
3. Cada agente solo toca los archivos listados en su tarea. Si necesita cambiar `packages/domain`, lo reporta y no lo edita.
4. La tarea está terminada cuando pasa su comando de aceptación **y** `pnpm lint && pnpm typecheck` en la raíz.
5. Si un `worker` falla su check dos veces → pasa a `reasoner`.
6. Merge a `main` con `--no-ff`, en el orden de la tabla (resuelve conflictos en `app.module.ts` el integrador).

## Olas

### Ola 0 — base (secuencial, bloquea todo)
| ID | Dificultad | Agente | Tarea |
|---|---|---|---|
| [T0](T00-scaffold.md) | Media | inline (opus) | Scaffold monorepo pnpm + Nest + Next + domain + CI |
| [T1](T01-domain.md) | Difícil | reasoner (opus) | Dominio OOP + puertos + contratos WS/REST |

### Ola 1 — paralelo (8 agentes)
| ID | Dificultad | Agente | Tarea | Toca |
|---|---|---|---|---|
| [T2](T02-gemini-transcriber.md) | Difícil | reasoner (opus) | Gemini Live + Chunked transcribers | `apps/api/src/transcription/**` |
| [T3](T03-orchestrator.md) | Difícil | reasoner (opus) | SessionOrchestrator + SessionPipeline + Mock transcriber | `apps/api/src/{orchestrator,persistence}/**`, `apps/api/src/transcription/mock*` |
| [T4](T04-audio-ingest.md) | Media | worker (sonnet) | FfmpegAudioSource + samples | `apps/api/src/ingest/**`, `samples/`, `scripts/` |
| [T5](T05-translator.md) | Media | worker (sonnet) | GeminiTranslator + Mock + glosario | `apps/api/src/translation/**` |
| [T6](T06-exporters.md) | Fácil | worker (haiku) | Exporters SRT/VTT/TXT | `packages/domain/src/export/**` |
| [T7](T07-realtime-rest.md) | Media | worker (sonnet) | Socket.IO gateway + REST sessions + export | `apps/api/src/realtime/**`, `apps/api/src/sessions/**` |
| [T8](T08-web-audience.md) | Media | worker (sonnet) | Web audiencia + overlay OBS | `apps/web/src/app/page.tsx`, `apps/web/src/app/{s,overlay}/**`, `apps/web/src/features/captions/**` |
| [T9](T09-web-admin.md) | Media | worker (sonnet) | Web panel de producción | `apps/web/src/app/admin/**`, `apps/web/src/features/admin/**` |

### Ola 2 — integración y docs
| ID | Dificultad | Agente | Tarea |
|---|---|---|---|
| [T10](T10-docs-docker.md) | Fácil | worker (haiku) | README, SCALING.md, Dockerfiles, compose |
| [T11](T11-integration.md) | Difícil | inline (opus) | Wiring final, e2e 2 sesiones, smoke con Gemini real |
| [T12](T12-mic-ingest.md) | Difícil | reasoner (opus) | Micrófono desde browser (AudioWorklet → WS) |

### Ola 3 — opcionales
| ID | Dificultad | Agente | Tarea |
|---|---|---|---|
| [T13](T13-optionals.md) | Fácil/Media | worker (sonnet) | Portugués, glosario editable, redis adapter |

## Cómo lanzar la Ola 1 (ejemplo)
Un solo mensaje con 8 llamadas `Agent` en paralelo, cada una con `isolation: "worktree"`, `subagent_type` según la tabla (`worker` con `model: "haiku"` para las Fáciles) y como prompt: *"Implementá `docs/tasks/T0X-*.md`. Leé primero `docs/tasks/CONTRACT.md`. No edites archivos fuera de los listados. Terminá solo cuando pase el comando de aceptación."*
