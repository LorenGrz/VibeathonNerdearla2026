# T12 — Micrófono desde el navegador
**Dificultad:** Difícil · **Agente:** `reasoner` (opus) · **Rama:** `feature/mic-ingest` · **Depende de:** T11

## Objetivo
- Web `/admin/mic/[id]`: `getUserMedia` → `AudioWorklet` que resamplea a 16 kHz mono Int16 y agrupa en 100 ms → `mic:chunk` (ArrayBuffer) al namespace `/mic`; vúmetro y botón start/stop.
- API `MicGateway` + `MicAudioSource implements AudioSourcePort`: cola por sesión que convierte los `mic:chunk` en `AsyncIterable<AudioChunk>`; backpressure (descartar si la cola > 2 s); solo un emisor por sesión.
- `FfmpegAudioSource` y `MicAudioSource` detrás de un `CompositeAudioSource` que despacha por `spec.kind`.

## Aceptación
```
pnpm --filter @subs/api test -- mic && pnpm --filter @subs/web test && pnpm typecheck
```
+ prueba manual hablando al micrófono con `TRANSCRIBER=live`.
