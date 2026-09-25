import type { TranscriptExporterLike } from './transcript-exporter.js';
import { toSrtTimestamp } from './timestamp.js';

/** TODO(T11): replace with `exporterFor('srt')` from `@subs/domain`. */
export const srtExporter: TranscriptExporterLike = {
  format: 'srt',
  mimeType: 'application/x-subrip',
  export(segments) {
    return segments
      .map((segment, index) =>
        [
          `${index + 1}`,
          `${toSrtTimestamp(segment.range.startMs)} --> ${toSrtTimestamp(segment.range.endMs)}`,
          segment.text,
        ].join('\n'),
      )
      .join('\n\n');
  },
};
