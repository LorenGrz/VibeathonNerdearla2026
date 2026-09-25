import type { TranscriptExporterLike } from './transcript-exporter.js';
import { toVttTimestamp } from './timestamp.js';

/** TODO(T11): replace with `exporterFor('vtt')` from `@subs/domain`. */
export const vttExporter: TranscriptExporterLike = {
  format: 'vtt',
  mimeType: 'text/vtt',
  export(segments) {
    const cues = segments.map(
      (segment) =>
        `${toVttTimestamp(segment.range.startMs)} --> ${toVttTimestamp(segment.range.endMs)}\n${segment.text}`,
    );
    return ['WEBVTT', '', ...cues].join('\n\n');
  },
};
