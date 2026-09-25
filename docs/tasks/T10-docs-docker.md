# T10 — README, escalado y Docker
**Dificultad:** Fácil · **Agente:** `worker` (model: haiku) · **Rama:** `feature/docs-docker` · **Depende de:** Ola 1 mergeada

## Objetivo
- `README.md` (EN, con resumen en ES): qué es, demo (link YouTube placeholder), stack, arquitectura (diagrama mermaid del pipeline), quickstart en Mock mode (sin key), modo Gemini (cómo obtener `GEMINI_API_KEY`, variables), cómo probar con `samples/`, OBS overlay, export, comandos (`dev/test/lint/typecheck/format`), decisiones de arquitectura, lecciones, próximos pasos, licencia MIT.
- `docs/SCALING.md`: una sesión = un pipeline = una conexión Live; `MAX_SESSIONS` por proceso; horizontal con N instancias + asignación de escenarios + `@socket.io/redis-adapter`; web stateless; límites de cuota de Gemini; estimación de costo por hora de charla (dejar fórmula y link a pricing, no inventar números).
- `docs/ARCHITECTURE.md`: capas (domain / application / adapters), puertos y adapters, flujo de eventos.
- `apps/api/Dockerfile` (incluye ffmpeg + yt-dlp), `apps/web/Dockerfile` (standalone), `compose.yaml` (api + web, `.env`).

## Aceptación
```
docker compose config && pnpm format:check
```
