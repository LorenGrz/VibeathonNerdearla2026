# T0 — Scaffold del monorepo
**Dificultad:** Media · **Agente:** inline (opus) · **Rama:** `feature/scaffold` · **Bloquea:** todo

## Objetivo
Monorepo pnpm vacío pero verde: `lint`, `typecheck`, `test` y `build` pasan en todos los paquetes.

## Pasos
1. `.gitignore` según el gate de CLAUDE.md (node, env, build, logs, OS/editor) + `samples/*.wav` grandes si hiciera falta.
2. Raíz: `package.json` (`private`, `packageManager: pnpm@12`, scripts `dev` (paralelo api+web), `build`, `lint`, `typecheck`, `test`, `format`, `format:check`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `eslint.config.mjs` (typescript-eslint flat), `.prettierrc`, `LICENSE` (MIT, Loren Graizzaro), `.nvmrc`.
3. `packages/domain` → `@subs/domain`: `src/index.ts`, `tsconfig.json`, Vitest, script `build` (`tsc`), `exports` a `dist`.
4. `apps/api` → `@subs/api`: `pnpm dlx @nestjs/cli new api --package-manager pnpm --skip-git --strict`; agregar `@nestjs/config`, `zod`, `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`, `@google/genai`; dependencia `"@subs/domain": "workspace:*"`; `setGlobalPrefix('api')`, CORS a `WEB_ORIGIN`; `src/shared/tokens.ts` con los tokens de CONTRACT.md; `src/config/env.ts` (zod) y `.env.example`; `GET /api/health`.
5. `apps/web` → `@subs/web`: `pnpm create next-app web --ts --app --src-dir --eslint --tailwind --use-pnpm --no-git`; `socket.io-client`; `"@subs/domain": "workspace:*"` + `transpilePackages`; Vitest + Testing Library; scripts `typecheck`, `test`.
6. Carpetas vacías con `.gitkeep`: `samples/`, `scripts/`, `docs/`.
7. `.github/workflows/ci.yml`: pnpm install → lint → typecheck → test → build.
8. Primer commit en `main` (`git branch -M main`), push, y a partir de ahí flujo de ramas.

## Aceptación
```
pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
