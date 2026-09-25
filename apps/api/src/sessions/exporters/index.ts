import { exporterFor } from '@subs/domain';
import type { TranscriptExporterMap } from './transcript-exporter.js';

export * from './transcript-exporter.js';

export const createTranscriptExporters = (): TranscriptExporterMap => ({
  srt: exporterFor('srt'),
  vtt: exporterFor('vtt'),
  txt: exporterFor('txt'),
});
