import type { TranscriptExporterLike } from './transcript-exporter.js';

/** TODO(T11): replace with `exporterFor('txt')` from `@subs/domain`. */
export const txtExporter: TranscriptExporterLike = {
  format: 'txt',
  mimeType: 'text/plain',
  export(segments) {
    return segments.map((segment) => segment.text).join('\n');
  },
};
