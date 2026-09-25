import type { ExportFormat, TranscriptExporter } from '@subs/domain';

export type TranscriptExporterMap = Readonly<Record<ExportFormat, TranscriptExporter>>;

export const TRANSCRIPT_EXPORTERS = Symbol('TRANSCRIPT_EXPORTERS');
