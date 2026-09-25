# T5 — Traductor Gemini + glosario
**Dificultad:** Media · **Agente:** `worker` (sonnet) · **Rama:** `feature/translator` · **Depende de:** T1

## Objetivo
- `GeminiTranslator implements TranslatorPort`: `generateContent` con `GEMINI_TEXT_MODEL`, temperatura baja, system instruction: traductor de subtítulos de conferencias técnicas, conservar términos técnicos, nombres propios y código sin traducir, salida = solo el texto traducido. Incluye `glossary.toPromptSection(target)`. Devuelve `segment.translate(target, text)`.
- Contexto: pasar las últimas 2 frases originales de la sesión como contexto (no traducirlas) para coherencia.
- Timeout 5 s + 1 reintento; si falla, lanzar error (el orquestador lo registra).
- Si `source === target` → devolver el segmento sin llamar al modelo.
- `MockTranslator` (`TRANSLATOR=mock`): prefija `[es] ` / `[en] ` al texto.
- `default-glossary.ts`: ~20 términos (Nerdearla, Kubernetes, deploy, pull request, open source, LLM, etc.).
- Factory en `translation.module.ts` por `TRANSLATOR`.

## Archivos
`apps/api/src/translation/**` + `*.spec.ts`.

## Aceptación
```
pnpm --filter @subs/api test -- translation && pnpm --filter @subs/api typecheck
```
Specs con cliente fake: el prompt incluye el glosario, same-language no llama al cliente, timeout → reintento → error.
