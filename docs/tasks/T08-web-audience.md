# T8 — Web de audiencia + overlay OBS
**Dificultad:** Media · **Agente:** `worker` (sonnet) · **Rama:** `feature/web-audience` · **Depende de:** T1 · Skill: `nextjs-ssr-frontend`

## Estilo
Seguir `docs/design/STYLE.md` (paleta y tipografías de nerdearla.com vía tokens Tailwind en `globals.css`; no hex sueltos). Leer `apps/web/AGENTS.md`: Next 16.3 tiene APIs nuevas.

## Objetivo
- `/` (server component): lista de sesiones desde `GET /api/sessions` (`cache: 'no-store'`), tarjeta por sesión con escenario, idioma original, estado (badge live) y botones por idioma disponible.
- `/s/[id]?lang=es` (client en la parte en vivo): hook `useCaptions(sessionId, lang)` en `features/captions/` con socket.io-client al namespace `/captions`; muestra historial + finales + el parcial actual en gris; autoscroll con pausa si el usuario scrollea arriba; selector de idioma (cambia room sin recargar); tamaño de fuente A-/A+ y alto contraste (persistidos en `localStorage`); `aria-live="polite"`; indicador de conexión.
- `/overlay/[id]?lang=en&lines=2`: fondo transparente, últimas N líneas grandes con sombra, para Browser Source de OBS/vMix.
- Cliente API tipado en `features/captions/api.ts` usando los tipos de `@subs/domain` (solo `contracts`).
- Mobile-first, accesible (contraste AA, foco visible).

## Archivos
`apps/web/src/app/page.tsx`, `apps/web/src/app/s/[id]/**`, `apps/web/src/app/overlay/[id]/**`, `apps/web/src/features/captions/**`, `apps/web/src/lib/api.ts`.

## Aceptación
```
pnpm --filter @subs/web lint && pnpm --filter @subs/web typecheck && pnpm --filter @subs/web test && pnpm --filter @subs/web build
```
Tests: reducer de captions (parcial reemplazado por final, orden, dedupe por id) y render del overlay con N líneas.
