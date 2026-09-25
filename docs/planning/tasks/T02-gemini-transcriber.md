# T2 — Transcriptores Gemini (Live + Chunked)
**Dificultad:** Difícil · **Agente:** `reasoner` (opus) · **Rama:** `feature/gemini-transcriber` · **Depende de:** T1

## Objetivo
Dos adapters de `TranscriberPort` con `@google/genai`:
- `GeminiLiveTranscriber`: abre una sesión de la Live API por `open()`, envía `AudioChunk` como `audio/pcm;rate=16000` (realtime input), usa **input audio transcription** para obtener el texto original. Emite parciales mientras llega texto y un final al detectar fin de turno / pausa (≥ 700 ms sin texto nuevo) o al superar ~12 s. Rango temporal a partir de `offsetMs` de los chunks.
- `GeminiChunkedTranscriber`: acumula ~4 s de PCM, lo envuelve en WAV y llama `generateContent` con prompt "transcribí literalmente en {lang}, sin comentarios" + glosario; emite solo finales. Sirve de fallback.

## Detalles
- **Antes de codear**, verificar en la doc oficial actual de Gemini: id del modelo Live vigente, formato de `sendRealtimeInput`, campo de transcripción de entrada, límite de duración de sesión y "session resumption". No inventar campos.
- Reconexión transparente al expirar la sesión Live (usar session resumption si existe; si no, reabrir) sin cortar el `AsyncIterable`.
- `close()` idempotente; respetar `signal`.
- Cliente de Gemini inyectado vía interfaz pequeña (`GeminiLiveClient`) para poder testear con un fake.
- Provider factory en `transcription.module.ts` elige por `TRANSCRIBER` (`live|chunked`; `mock` lo registra T3).

## Archivos
`apps/api/src/transcription/{gemini-live.transcriber.ts,gemini-chunked.transcriber.ts,gemini.client.ts,wav.ts,transcription.module.ts}` + `*.spec.ts`.

## Aceptación
```
pnpm --filter @subs/api test -- transcription && pnpm --filter @subs/api typecheck
```
Smoke manual (Loren, con key): `TRANSCRIBER=live pnpm --filter @subs/api dev` + sesión con `samples/en-*.mp3`.
