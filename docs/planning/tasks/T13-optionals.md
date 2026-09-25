# T13 — Opcionales (según tiempo)
**Agente:** `worker` (sonnet), una rama por ítem · **Depende de:** T11

| Ítem | Dificultad | Qué | Aceptación |
|---|---|---|---|
| Portugués | Fácil | Ya está en `SUPPORTED_LANGUAGES`; agregar guion Mock `pt`, labels en web, probar EN→PT | `pnpm test` |
| ES→EN | Fácil | Preset "Demo" con sesión ES y target `en` | `pnpm test` |
| Glosario editable | Media | `PUT /api/sessions/:id/glossary` + editor en `/admin` | `pnpm test && pnpm --filter @subs/api test:e2e` |
| Multi-instancia | Media | `@socket.io/redis-adapter` opcional por `REDIS_URL` + servicio redis en compose | `docker compose config && pnpm test` |
| Export automático | Fácil | Al `stop`, guardar SRT/VTT de cada idioma en `exports/` | `pnpm test` |
