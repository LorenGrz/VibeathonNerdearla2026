# T4 — Ingesta de audio con ffmpeg + samples
**Dificultad:** Media · **Agente:** `worker` (sonnet) · **Rama:** `feature/audio-ingest` · **Depende de:** T1

## Objetivo
`FfmpegAudioSource implements AudioSourcePort`.
- `file`: `ffmpeg -re -i <path> -f s16le -ac 1 -ar 16000 pipe:1` (`-re` = simula tiempo real para la demo). Path relativo se resuelve contra `SAMPLES_DIR`; rechazar path traversal fuera de `SAMPLES_DIR`.
- `url`: si es YouTube → `yt-dlp -f bestaudio -g <url>` para obtener URL directa; luego ffmpeg con `-re` sólo si no es un stream en vivo. Validar esquema `http(s)|rtmp|srt`.
- Emitir chunks de exactamente 100 ms (3200 bytes) con `offsetMs` acumulado.
- `signal.abort()` mata el proceso (`SIGTERM`) y cierra el iterable; errores de ffmpeg (stderr + exit code ≠ 0) → excepción.
- `spawn` sin shell (nunca interpolar strings a un shell).
- `GET /api/samples` lista archivos de audio en `SAMPLES_DIR` (puede vivir acá como `SamplesController`).

## Samples
`scripts/fetch-samples.sh`: con `yt-dlp` + `ffmpeg` baja y recorta ~90 s de una charla EN y una ES de Nerdearla en YouTube a `samples/en-nerdearla.mp3` y `samples/es-nerdearla.mp3` (mono, 64 kbps). URLs como variables al principio del script. Además `samples/tone-2s.mp3` generado con ffmpeg (`sine`) para tests.
`samples/README.md`: origen y licencia de cada clip.

## Archivos
`apps/api/src/ingest/**`, `scripts/fetch-samples.sh`, `samples/README.md`, `samples/tone-2s.mp3`.

## Aceptación
```
pnpm --filter @subs/api test -- ingest && pnpm --filter @subs/api typecheck
```
El spec lee `samples/tone-2s.mp3` (sin `-re` vía opción `realtime: false`) y espera ~20 chunks de 3200 bytes; abort corta el proceso.
