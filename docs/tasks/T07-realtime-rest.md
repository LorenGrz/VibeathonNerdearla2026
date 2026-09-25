# T7 — Gateway en tiempo real + REST de sesiones + export
**Dificultad:** Media · **Agente:** `worker` (sonnet) · **Rama:** `feature/realtime-rest` · **Depende de:** T1

## Objetivo
- `SessionsController` con los endpoints de CONTRACT.md (`/sessions`, start/stop, transcript, export). DTOs validados con zod (`CreateSessionDto`); errores de dominio → `HttpException` vía un `DomainExceptionFilter` (InvalidTransition → 409, NotFound → 404, InvalidLanguage → 400).
- `SessionsService` (casos de uso): usa `SESSION_REPOSITORY`, `TRANSCRIPT_REPOSITORY`, y una interfaz `SessionRunner { start(id): Promise<void>; stop(id): Promise<void> }` con token `SESSION_RUNNER` (la implementa T3; acá usar un stub en tests).
- Export: `exporterFor(format)` de `@subs/domain` + `Content-Disposition: attachment; filename="<title>-<lang>.<ext>"`.
- `CaptionsGateway` (`/captions`): `captions:join` valida sesión+idioma, une a `captionRoom(...)` y responde `captions:history` (últimos 20 finales); `captions:leave`.
- `AdminGateway` (`/admin`): emite `sessions:snapshot` cada 1 s.
- `SocketIoEventPublisher implements EventPublisherPort`: `SegmentTranscribed`/`SegmentTranslated` → `caption` al room del idioma del segmento; eventos de estado → `session:status` a todos los rooms de la sesión.

## Archivos
`apps/api/src/sessions/**`, `apps/api/src/realtime/**`, `apps/api/src/shared/domain-exception.filter.ts`, `apps/api/test/sessions.e2e-spec.ts`.

## Aceptación
```
pnpm --filter @subs/api test && pnpm --filter @subs/api test:e2e && pnpm --filter @subs/api typecheck
```
e2e (supertest + socket.io-client, repos in-memory, runner stub): crear sesión, start, cliente unido a `es` recibe sólo captions `es`, export SRT devuelve cabeceras correctas.
