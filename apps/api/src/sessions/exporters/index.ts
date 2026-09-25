import { srtExporter } from './srt.exporter.js';
import { vttExporter } from './vtt.exporter.js';
import { txtExporter } from './txt.exporter.js';
import type { TranscriptExporterMap } from './transcript-exporter.js';

export * from './transcript-exporter.js';
export { srtExporter } from './srt.exporter.js';
export { vttExporter } from './vtt.exporter.js';
export { txtExporter } from './txt.exporter.js';

/** TODO(T11): replace with a map built from `exporterFor` (@subs/domain). */
export const createTranscriptExporters = (): TranscriptExporterMap => ({
  srt: srtExporter,
  vtt: vttExporter,
  txt: txtExporter,
});
