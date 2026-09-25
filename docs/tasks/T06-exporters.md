# T6 — Exporters SRT / VTT / TXT
**Dificultad:** Fácil · **Agente:** `worker` (model: haiku) · **Rama:** `feature/exporters` · **Depende de:** T1

## Objetivo
En `packages/domain/src/export/`:
- `interface TranscriptExporter { readonly format: ExportFormat; readonly mimeType: string; export(segments: readonly TranscriptSegment[]): string }`
- `SrtExporter` (`HH:MM:SS,mmm`, índice desde 1, línea en blanco entre bloques), `VttExporter` (`WEBVTT` + `HH:MM:SS.mmm`), `TextExporter` (un párrafo por segmento).
- Partir textos largos en líneas de máx. 42 caracteres (sin cortar palabras), máx. 2 líneas por bloque; si sobra, dividir el bloque repartiendo el tiempo proporcionalmente.
- `exporterFor(format: ExportFormat): TranscriptExporter`.
- Re-exportar desde `src/index.ts`.

## Aceptación
```
pnpm --filter @subs/domain test && pnpm --filter @subs/domain build
```
Tests: formato de tiempo (0, 59.999 s, >1 h), lista vacía, wrapping a 42 chars, división de bloques largos, snapshot de un SRT y un VTT completos.
