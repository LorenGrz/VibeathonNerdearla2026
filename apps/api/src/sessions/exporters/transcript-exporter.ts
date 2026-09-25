import type { ExportFormat, TranscriptSegment } from '@subs/domain';

/**
 * Minimal local contract for subtitle exporters.
 * TODO(T11): replace with `exporterFor` from `@subs/domain` once T6 lands, and drop this file.
 */
export interface TranscriptExporterLike {
  readonly format: ExportFormat;
  readonly mimeType: string;
  export(segments: readonly TranscriptSegment[]): string;
}

export type TranscriptExporterMap = Readonly<Record<ExportFormat, TranscriptExporterLike>>;

export const TRANSCRIPT_EXPORTERS = Symbol('TRANSCRIPT_EXPORTERS');
