# T1 — Dominio OOP, puertos y contratos
**Dificultad:** Difícil · **Agente:** `reasoner` (opus) · **Rama:** `feature/domain` · **Depende de:** T0 · **Bloquea:** Ola 1

## Objetivo
Implementar `packages/domain` exactamente como define [`CONTRACT.md`](../specs/CONTRACT.md) (menos `export/`, que es T6). Es el único lugar con reglas de negocio; Nest y Next solo lo usan.

## Archivos
`packages/domain/src/{shared,language,session,transcript,glossary,events,ports,contracts}/**`, `packages/domain/src/index.ts`.

## Reglas
- Clases con constructor privado + factories estáticas; value objects inmutables con `equals()`.
- Máquina de estados de `Session` con transiciones explícitas; transición inválida → `InvalidSessionTransitionError extends DomainError`.
- `Session` acumula eventos; `pullEvents()` los vacía.
- `Transcript.add` ignora parciales y mantiene orden por `startMs`.
- `SessionMetrics` calcula p50/p95 sobre una ventana circular de 100 muestras.
- `Clock` e `IdGenerator` inyectables (default: `Date`, `crypto.randomUUID`) para tests deterministas.
- Contratos: solo `interface`/`type`/constantes, cero clases (los consume el browser).
- Sin dependencias runtime.

## Tests (Vitest)
Transiciones válidas/inválidas de `Session`, eventos emitidos, `languages()` sin duplicados, `LanguageCode.of('fr')` falla, `Transcript` orden + filtrado de parciales, `Glossary.toPromptSection`, percentiles de `SessionMetrics`, `toSnapshot()`/`toDto()`.

## Aceptación
```
pnpm --filter @subs/domain test && pnpm --filter @subs/domain build && pnpm typecheck
```
