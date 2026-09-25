# T9 — Panel de producción
**Dificultad:** Media · **Agente:** `worker` (sonnet) · **Rama:** `feature/web-admin` · **Depende de:** T1 · Skill: `nextjs-ssr-frontend`

## Estilo
Seguir `docs/planning/specs/STYLE.md` (paleta y tipografías de nerdearla.com vía tokens Tailwind en `globals.css`; no hex sueltos). Leer `apps/web/AGENTS.md`: Next 16.3 tiene APIs nuevas.

## Objetivo
- `/admin`: tabla de sesiones en vivo vía `/admin` namespace (`sessions:snapshot`): título, escenario, estado, chunks, latencia p50/p95, errores + último error, última actividad (resaltar si > 10 s sin actividad estando live).
- Acciones: start/stop/delete, links a `/s/[id]`, `/overlay/[id]` y descargas SRT/VTT/TXT por idioma.
- Formulario "Nueva sesión": título, escenario, idioma original, idiomas destino (checkboxes), fuente (`file` con select desde `GET /api/samples`, `url`, `mic`), glosario opcional (textarea `término = traducción`).
- Botón "Demo: 2 sesiones" que crea y arranca EN + ES con los samples.
- Sin auth en MVP; dejar `TODO` y nota en README (fuera de alcance).

## Archivos
`apps/web/src/app/admin/**`, `apps/web/src/features/admin/**`.

## Aceptación
```
pnpm --filter @subs/web lint && pnpm --filter @subs/web typecheck && pnpm --filter @subs/web test && pnpm --filter @subs/web build
```
Tests: parser del glosario, validación del formulario, formato de métricas.
