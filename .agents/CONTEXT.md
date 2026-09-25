# Contexto del repo — LiveSubs (Vibeathon Nerdearla 2026)

- **Qué:** subtítulos en vivo open source para conferencias: audio de N escenarios → transcripción original + traducción (EN↔ES, PT opcional) → web de audiencia, overlay OBS, panel de producción.
- **Deadline:** 2026-09-25 (vibeathon 24–25 sep). Repo: github.com/LorenGrz/VibeathonNerdearla2026, licencia MIT.
- **Stack:** monorepo pnpm · `packages/domain` (TS puro, OOP, sin deps) · `apps/api` NestJS + Socket.IO + `@google/genai` + ffmpeg/yt-dlp · `apps/web` Next.js App Router + Tailwind.
- **Decisiones:** dominio compartido con puertos/adaptadores; Gemini Live para ASR, Gemini Flash texto para traducción con glosario, fallback chunked, Mock para correr sin key; persistencia in-memory detrás de puertos.
- **Fuente de verdad:** `docs/planning/` (ver su README): `PLAN.md`, `specs/CONTRACT.md` (no cambiar sin reasoner), `specs/STYLE.md`, tareas en `tasks/Txx-*.md`.
- **Tests:** Vitest en todos los paquetes. Verificación raíz: `pnpm lint && pnpm typecheck && pnpm test`.
- **Git:** ramas `feature/<slug>`, merge `--no-ff` a `main`.
- **Gotchas de versiones:** Nest 12 es ESM `nodenext` → imports relativos con `.js`; lint de api = `oxlint --type-aware`. Next 16.3 cambió APIs → leer `apps/web/node_modules/next/dist/docs/` antes de escribir código (ver `apps/web/AGENTS.md`); `typecheck` de web corre `next typegen` primero. `@subs/domain` se consume desde `dist/` → `pnpm build:domain` tras tocar el dominio. pnpm 12 falla ante postinstalls no aprobados → declararlos en `allowBuilds` de `pnpm-workspace.yaml`.
