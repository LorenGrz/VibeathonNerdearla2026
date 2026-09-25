# T11 — Integración final y demo
**Dificultad:** Difícil · **Agente:** inline (opus) · **Rama:** `feature/integration` · **Depende de:** Ola 1

## Objetivo
- `AppModule` cablea todos los módulos; `SessionOrchestrator` registrado como `SESSION_RUNNER`; factories por env.
- e2e `apps/api/test/concurrency.e2e-spec.ts`: 2 sesiones Mock en paralelo con `tone-2s.mp3`, ambas `live`, captions aisladas por room.
- Smoke real: `TRANSCRIBER=live TRANSLATOR=gemini` con `en-nerdearla.mp3` → original EN + ES; `es-nerdearla.mp3` → ES + EN. Medir latencia p50 en `/admin`.
- Grabar demo 1–2 min usando `/overlay` en OBS con subtítulos EN generados por el proyecto.
- Revisión final con `code-review-safety` (sin secretos commiteados, path traversal en samples, spawn sin shell).

## Aceptación
```
pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @subs/api test:e2e && pnpm build
```
